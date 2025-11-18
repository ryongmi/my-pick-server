import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PlatformType } from '@common/enums/index.js';

import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { ContentService } from '../../content/services/content.service.js';
import { ContentCategoryService } from '../../content/services/content-category.service.js';
import {
  CreatorPlatformEntity,
  VideoSyncStatus,
} from '../../creator/entities/creator-platform.entity.js';
import { ApiProvider } from '../enums/index.js';
import {
  mapYouTubeVideoToContent,
  mapYouTubeCategoryToContentCategory,
  mapYouTubeStatisticsToContentStatistics,
} from '../utils/youtube-to-content.mapper.js';

import { YouTubeApiService } from './youtube-api.service.js';
import { QuotaMonitorService } from './quota-monitor.service.js';

@Injectable()
export class YouTubeSyncScheduler {
  private readonly logger = new Logger(YouTubeSyncScheduler.name);

  constructor(
    private readonly youtubeApi: YouTubeApiService,
    private readonly quotaMonitor: QuotaMonitorService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly contentService: ContentService,
    private readonly contentCategoryService: ContentCategoryService
  ) {}

  /**
   * 매시간 YouTube 콘텐츠 동기화
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncYouTubeContent(): Promise<void> {
    this.logger.log('Starting YouTube content sync');

    try {
      // 할당량 체크
      const quotaSummary = await this.quotaMonitor.getQuotaSummary();
      const youtubeQuota = quotaSummary.youtube;

      if (youtubeQuota && youtubeQuota.usagePercentage > 95) {
        this.logger.warn('YouTube quota limit reached, skipping sync', {
          usagePercentage: youtubeQuota.usagePercentage.toFixed(1) + '%',
          remainingQuota: youtubeQuota.remainingQuota,
        });
        return;
      }

      // 활성화된 YouTube 플랫폼 조회
      const platforms = await this.creatorPlatformService.findActiveYouTubePlatforms();

      this.logger.log(`Found ${platforms.length} active YouTube platforms to sync`);

      let syncedCount = 0;
      let failedCount = 0;

      for (const platform of platforms) {
        try {
          await this.syncPlatform(platform);
          syncedCount++;
        } catch (error: unknown) {
          failedCount++;
          this.logger.error(`Failed to sync platform ${platform.id}`, {
            platformId: platform.id,
            platformUsername: platform.platformUsername,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
          // 개별 플랫폼 실패는 전체 동기화를 중단하지 않음
        }
      }

      this.logger.log('YouTube content sync completed', {
        total: platforms.length,
        synced: syncedCount,
        failed: failedCount,
      });
    } catch (error: unknown) {
      this.logger.error('YouTube content sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * 수동 동기화 트리거 (Admin API용)
   */
  async syncSinglePlatform(
    platformId: string
  ): Promise<{ success: boolean; message: string; syncedCount?: number }> {
    try {
      const platform = await this.creatorPlatformService.findById(platformId);

      if (!platform) {
        return { success: false, message: '플랫폼을 찾을 수 없습니다.' };
      }

      if (!platform.isActive) {
        return { success: false, message: '비활성화된 플랫폼입니다.' };
      }

      await this.syncPlatform(platform);

      const syncProgress = platform.syncProgress;
      const syncedCount = syncProgress?.syncedVideoCount || 0;

      return {
        success: true,
        message: '동기화가 완료되었습니다.',
        syncedCount,
      };
    } catch (error: unknown) {
      this.logger.error('Manual sync failed', {
        platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '동기화 실패',
      };
    }
  }

  /**
   * 플랫폼별 동기화
   */
  private async syncPlatform(platform: CreatorPlatformEntity): Promise<void> {
    const syncProgress = platform.syncProgress;

    // Phase 1: initialSyncCompleted 플래그로 판단
    const isInitialSync = !syncProgress?.initialSyncCompleted;

    // 항상 50개씩 가져옴 (초기/증분 모두)
    const maxResults = 50;

    this.logger.debug(`Syncing platform ${platform.id}`, {
      platformId: platform.platformId,
      platformUsername: platform.platformUsername,
      isInitialSync,
      maxResults,
      hasNextPageToken: !!syncProgress?.nextPageToken,
      syncedVideoCount: syncProgress?.syncedVideoCount || 0,
    });

    // 동기화 시작 상태로 업데이트
    await this.creatorPlatformService.updateSyncProgress(platform.id, {
      videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
    });

    try {
      // Phase 2: 페이지네이션 지원
      const options: { maxResults: number; pageToken?: string; publishedAfter?: Date } = {
        maxResults,
      };

      if (isInitialSync) {
        // 최초 동기화 중 - pageToken 사용
        if (syncProgress?.nextPageToken) {
          options.pageToken = syncProgress.nextPageToken;
        }
      } else {
        // 증분 동기화 - publishedAfter 사용
        if (syncProgress?.lastVideoSyncAt) {
          options.publishedAfter = new Date(syncProgress.lastVideoSyncAt);
        }
      }

      const result = await this.youtubeApi.getChannelVideos(platform.platformId, options);

      if (result.videos.length > 0) {
        // YouTube DTO를 Content DTO로 변환
        const contentDtos = result.videos.map((video) =>
          mapYouTubeVideoToContent(video, platform.creatorId)
        );

        // Content 배치 저장
        const savedContents = await this.contentService.createBatch(contentDtos);

        // 카테고리 저장
        const categoryDtos = result.videos
          .map((video, index) => {
            const savedContent = savedContents[index];
            if (!savedContent) return null;
            const category = mapYouTubeCategoryToContentCategory(savedContent.id, video.categoryId);
            return category;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (categoryDtos.length > 0) {
          await this.contentCategoryService.addBatch(categoryDtos);
        }

        // 통계 정보 업데이트
        for (let i = 0; i < result.videos.length; i++) {
          const video = result.videos[i];
          const content = savedContents[i];
          if (!video || !content) continue;
          const statistics = mapYouTubeStatisticsToContentStatistics(video);
          await this.contentService.updateStatistics(content.id, statistics);
        }

        this.logger.log(`Synced ${result.videos.length} videos for platform ${platform.id}`, {
          platformId: platform.platformId,
          videoCount: result.videos.length,
          isInitialSync,
        });
      } else {
        this.logger.debug(`No new videos found for platform ${platform.id}`);
      }

      // Creator 통계 업데이트 (채널 정보 가져오기)
      try {
        const channelInfo = await this.youtubeApi.getChannelInfo(platform.platformId);
        if (channelInfo) {
          await this.creatorService.updateStatistics(platform.creatorId, {
            totalSubscribers: channelInfo.statistics.subscriberCount,
            totalVideos: channelInfo.statistics.videoCount,
            totalViews: channelInfo.statistics.viewCount,
          });
          this.logger.debug(`Updated creator statistics for ${platform.creatorId}`, {
            subscribers: channelInfo.statistics.subscriberCount,
            videos: channelInfo.statistics.videoCount,
          });
        }
      } catch (error: unknown) {
        this.logger.warn(`Failed to update creator statistics for ${platform.creatorId}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // 통계 업데이트 실패는 전체 동기화를 중단하지 않음
      }

      // 동기화 완료 상태로 업데이트
      const newSyncedCount = (syncProgress?.syncedVideoCount || 0) + result.videos.length;

      if (isInitialSync) {
        if (result.nextPageToken) {
          // 아직 더 가져올 영상이 있음 - 다음 페이지 정보 저장
          await this.creatorPlatformService.updateSyncProgress(platform.id, {
            videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
            nextPageToken: result.nextPageToken,
            syncedVideoCount: newSyncedCount,
            failedSyncCount: 0,
          });

          this.logger.log(`Initial sync in progress for platform ${platform.id}`, {
            syncedCount: newSyncedCount,
            hasMorePages: true,
          });
        } else {
          // 최초 동기화 완료 (nextPageToken 필드는 생략 - 제거하지 않고 유지)
          await this.creatorPlatformService.updateSyncProgress(platform.id, {
            videoSyncStatus: VideoSyncStatus.SYNCED,
            initialSyncCompleted: true,
            lastVideoSyncAt: new Date().toISOString(),
            syncedVideoCount: newSyncedCount,
            failedSyncCount: 0,
          });

          this.logger.log(`Initial sync completed for platform ${platform.id}`, {
            totalSyncedCount: newSyncedCount,
          });
        }
      } else {
        // 증분 동기화 완료
        await this.creatorPlatformService.updateSyncProgress(platform.id, {
          videoSyncStatus: VideoSyncStatus.SYNCED,
          lastVideoSyncAt: new Date().toISOString(),
          syncedVideoCount: newSyncedCount,
          failedSyncCount: 0,
        });

        this.logger.log(`Incremental sync completed for platform ${platform.id}`, {
          newVideosCount: result.videos.length,
        });
      }
    } catch (error: unknown) {
      // 동기화 실패 상태로 업데이트
      await this.creatorPlatformService.updateSyncProgress(platform.id, {
        videoSyncStatus: VideoSyncStatus.FAILED,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        failedSyncCount: (syncProgress?.failedSyncCount || 0) + 1,
      });

      throw error; // 상위로 에러 전파
    }
  }

  /**
   * 크리에이터의 모든 콘텐츠 동기화 (전체 동기화)
   * 사용 사례: 크리에이터 승인 후 전체 콘텐츠 수집
   */
  async syncAllContent(
    platformId: string
  ): Promise<{
    success: boolean;
    message: string;
    totalCount?: number;
    estimatedQuotaUsage?: number;
    error?: string;
  }> {
    try {
      const platform = await this.creatorPlatformService.findById(platformId);

      if (!platform) {
        return { success: false, message: '플랫폼을 찾을 수 없습니다.' };
      }

      if (!platform.isActive) {
        return { success: false, message: '비활성화된 플랫폼입니다.' };
      }

      // 1. 동기화 상태를 초기 상태로 리셋
      await this.creatorPlatformService.updateSyncProgress(platform.id, {
        videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
        isFullSyncMode: true,
        initialSyncCompleted: false,
        syncedVideoCount: 0,
        fullSyncStartedAt: new Date().toISOString(),
        syncStartedAt: new Date().toISOString(),
      });

      // 2. YouTube API에서 전체 비디오 개수 조회
      const channelInfo = await this.youtubeApi.getChannelInfo(platform.platformId);
      const totalVideoCount = parseInt(String(channelInfo?.statistics.videoCount || '0'), 10);
      const estimatedCallsNeeded = Math.ceil(totalVideoCount / 50);
      const estimatedQuota = estimatedCallsNeeded * 2;

      this.logger.log('Starting full sync for platform', {
        platformId: platform.id,
        platformUsername: platform.platformUsername,
        totalVideoCount,
        estimatedQuota,
      });

      // 3. 전체 콘텐츠 재귀적 동기화
      await this.syncAllContentRecursive(platform, totalVideoCount);

      return {
        success: true,
        message: '전체 콘텐츠 동기화가 완료되었습니다.',
        totalCount: totalVideoCount,
        estimatedQuotaUsage: estimatedQuota,
      };
    } catch (error: unknown) {
      this.logger.error('Full sync failed', {
        platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        message: '동기화 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 재귀적 전체 콘텐츠 동기화 (nextPageToken 처리)
   */
  private async syncAllContentRecursive(
    platform: CreatorPlatformEntity,
    totalCount: number,
    pageToken?: string
  ): Promise<void> {
    // 할당량 체크 (90% 초과 시 일시정지)
    const quotaSummary = await this.quotaMonitor.getQuotaSummary();
    const youtubeQuota = quotaSummary.youtube;

    if (youtubeQuota && youtubeQuota.usagePercentage > 90) {
      this.logger.warn('YouTube quota approaching limit, pausing full sync', {
        usagePercentage: youtubeQuota.usagePercentage.toFixed(1) + '%',
        platformId: platform.id,
      });
      // 현재 상태 저장하고 중단 (관리자가 수동으로 재개 가능)
      return;
    }

    const maxResults = 50;
    const options: { maxResults: number; pageToken?: string } = { maxResults };

    if (pageToken) {
      options.pageToken = pageToken;
    }

    try {
      // YouTube API로 비디오 가져오기
      const result = await this.youtubeApi.getChannelVideos(platform.platformId, options);

      if (result.videos.length > 0) {
        // Content 변환 및 저장
        const contentDtos = result.videos.map((video) =>
          mapYouTubeVideoToContent(video, platform.creatorId)
        );

        const savedContents = await this.contentService.createBatch(contentDtos);

        this.logger.debug('Saved batch of contents', {
          platformId: platform.id,
          count: savedContents.length,
        });

        // 카테고리 업데이트
        const categoryDtos = result.videos
          .filter((video) => video.categoryId)
          .map((video) => mapYouTubeCategoryToContentCategory(video.categoryId!, platform.platformType))
          .filter((dto): dto is NonNullable<typeof dto> => dto !== null);

        if (categoryDtos.length > 0) {
          await this.contentCategoryService.addBatch(categoryDtos);
        }

        // 통계 업데이트
        for (let i = 0; i < result.videos.length; i++) {
          const video = result.videos[i];
          const content = savedContents[i];
          if (!video || !content) continue;
          const statistics = mapYouTubeStatisticsToContentStatistics(video);
          await this.contentService.updateStatistics(content.id, statistics);
        }

        // 진행 상황 업데이트
        const newSyncedCount = (platform.syncProgress?.syncedVideoCount || 0) + result.videos.length;
        const remainingCount = Math.max(0, totalCount - newSyncedCount);
        const progressPercent = totalCount > 0 ? Math.round((newSyncedCount / totalCount) * 100) : 0;

        const updateData: Partial<typeof platform.syncProgress> = {
          videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
          syncedVideoCount: newSyncedCount,
          fullSyncProgress: {
            syncedCount: newSyncedCount,
            remainingCount,
            progressPercent,
          },
        };

        if (result.nextPageToken) {
          updateData.nextPageToken = result.nextPageToken;
        }

        await this.creatorPlatformService.updateSyncProgress(platform.id, updateData);

        this.logger.log('Full sync progress updated', {
          platformId: platform.id,
          syncedCount: newSyncedCount,
          totalCount,
          progressPercent: `${progressPercent}%`,
        });
      }

      // 다음 페이지 확인
      if (result.nextPageToken) {
        // 재귀: 다음 페이지 처리
        await this.syncAllContentRecursive(platform, totalCount, result.nextPageToken);
      } else {
        // 모든 페이지 처리 완료
        await this.creatorPlatformService.updateSyncProgress(platform.id, {
          videoSyncStatus: VideoSyncStatus.SYNCED,
          initialSyncCompleted: true,
          isFullSyncMode: false,
          lastVideoSyncAt: new Date().toISOString(),
          syncCompletedAt: new Date().toISOString(),
        });

        this.logger.log('Full sync completed for platform', {
          platformId: platform.id,
          totalSynced: platform.syncProgress?.syncedVideoCount,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Full sync recursive step failed', {
        platformId: platform.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // 에러 상태 저장하고 재귀 중단
      await this.creatorPlatformService.updateSyncProgress(platform.id, {
        videoSyncStatus: VideoSyncStatus.FAILED,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        failedSyncCount: (platform.syncProgress?.failedSyncCount || 0) + 1,
      });

      throw error;
    }
  }

  /**
   * 초기 동기화 재개 (실패한 경우)
   */
  async resumeInitialSync(
    platformId: string
  ): Promise<{ success: boolean; message: string; resumedCount?: number; error?: string }> {
    try {
      const platform = await this.creatorPlatformService.findById(platformId);

      if (!platform) {
        return { success: false, message: '플랫폼을 찾을 수 없습니다.' };
      }

      // initialSyncCompleted = false인 경우만 재개 가능
      if (platform.syncProgress?.initialSyncCompleted) {
        return {
          success: false,
          message: '초기 동기화가 이미 완료되었습니다.',
        };
      }

      // 현재 진행 상황에서 이어서 시작
      await this.syncPlatform(platform);

      return {
        success: true,
        message: '초기 동기화가 재개되었습니다.',
        resumedCount: platform.syncProgress?.syncedVideoCount || 0,
      };
    } catch (error: unknown) {
      this.logger.error('Resume sync failed', {
        platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: '재개 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 매일 자정 할당량 정리
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldQuotaRecords(): Promise<void> {
    this.logger.log('Starting quota records cleanup');

    try {
      const result = await this.quotaMonitor.cleanupOldQuotaRecords();
      this.logger.log(`Cleaned up ${result.deletedCount} old quota records`);
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup quota records', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
