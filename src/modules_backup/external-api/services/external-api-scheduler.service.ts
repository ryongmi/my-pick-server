import { Injectable, Logger, HttpException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ContentService } from '@modules/content/services/index.js';
import { CreateContentDto } from '@modules/content/dto/index.js';
import { ContentEntity } from '@modules/content/entities/index.js';
import { VideoSyncStatus, PlatformType, SyncStatus } from '@common/enums/index.js';
import { CreatorService, CreatorEntity, CreatorPlatformEntity, CreatorPlatformService } from '@modules/creator/index.js';
import { ContentType } from '@modules/content/enums/index.js';

import { ExternalApiException } from '../exceptions/index.js';

import { YouTubeApiService } from './youtube-api.service.js';
import { TwitterApiService } from './twitter-api.service.js';
import { QuotaMonitorService } from './quota-monitor.service.js';

@Injectable()
export class ExternalApiSchedulerService {
  private readonly logger = new Logger(ExternalApiSchedulerService.name);
  private isYouTubeSyncRunning = false;
  private isTwitterSyncRunning = false;

  constructor(
    private readonly youtubeApiService: YouTubeApiService,
    private readonly twitterApiService: TwitterApiService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly contentService: ContentService,
    private readonly quotaMonitorService: QuotaMonitorService
  ) {}

  // ==================== SCHEDULED JOBS ====================

  @Cron(CronExpression.EVERY_HOUR)
  async syncYouTubeContent(): Promise<void> {
    if (this.isYouTubeSyncRunning) {
      this.logger.warn('YouTube sync already running, skipping');
      return;
    }

    this.isYouTubeSyncRunning = true;

    try {
      this.logger.log('Starting YouTube content synchronization');

      const youtubePlatforms = await this.creatorPlatformService.findActiveYouTubePlatformsForSync();

      this.logger.debug('Found YouTube platforms to sync', {
        count: youtubePlatforms.length,
      });

      let totalSynced = 0;
      let totalErrors = 0;

      for (const platform of youtubePlatforms) {
        try {
          let syncedCount = 0;

          // 동기화 상태에 따른 분기 처리
          switch (platform.videoSyncStatus) {
            case VideoSyncStatus.NEVER_SYNCED:
            case VideoSyncStatus.CONSENT_CHANGED:
              syncedCount = await this.performFullSync(platform);
              break;

            case VideoSyncStatus.INCREMENTAL:
              syncedCount = await this.performIncrementalSync(platform);
              break;

            default:
              this.logger.warn('Unknown video sync status', {
                platformId: platform.id,
                videoSyncStatus: platform.videoSyncStatus,
              });
              continue;
          }

          totalSynced += syncedCount;

          // 채널 정보 업데이트 (24시간마다)
          if (this.shouldUpdateChannelInfo(platform)) {
            await this.updateYouTubeChannelInfo(platform);
          }

          this.logger.debug('YouTube channel synced successfully', {
            creatorId: platform.creatorId,
            channelId: platform.platformId,
            syncedCount,
          });
        } catch (error: unknown) {
          totalErrors++;

          // 에러 상태로 업데이트
          await this.creatorPlatformService.updateSyncStatus(platform.id, {
            lastSyncAt: new Date(),
            syncStatus: SyncStatus.ERROR,
          });

          this.logger.error('YouTube channel sync failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId: platform.creatorId,
            channelId: platform.platformId,
          });
        }

        // API 레이트 리미팅을 위한 지연
        await this.delay(1000);
      }

      this.logger.log('YouTube content synchronization completed', {
        totalPlatforms: youtubePlatforms.length,
        totalSynced,
        totalErrors,
      });
    } catch (error: unknown) {
      this.logger.error('YouTube sync job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isYouTubeSyncRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredContent(): Promise<void> {
    try {
      this.logger.log('Starting daily expired content cleanup');

      const result = await this.contentService.cleanupExpiredContent();

      if (result.deletedCount > 0 || result.authorizedDataCount > 0) {
        this.logger.log('Expired content cleanup completed with authorization logic', {
          deletedNonAuthorizedData: result.deletedCount,
          preservedAuthorizedData: result.authorizedDataCount,
          totalNonAuthorizedExpired: result.nonAuthorizedDataCount,
        });
      } else {
        this.logger.debug('No expired content found during cleanup');
      }

      // Rolling Window: 비동의 크리에이터 데이터 정리 (YouTube API 30일 정책)
      const rollingWindowResult = await this.contentService.batchCleanupNonConsentedData();

      if (rollingWindowResult.totalDeleted > 0) {
        this.logger.log('Rolling window cleanup completed for non-consented creators', {
          processedCreators: rollingWindowResult.processedCreators,
          totalDeleted: rollingWindowResult.totalDeleted,
          totalRetained: rollingWindowResult.totalRetained,
          errors: rollingWindowResult.errors,
        });
      }

      // 만료 예정 콘텐츠 통계 로깅
      const stats = await this.contentService.getExpiredContentStats();
      if (stats.expiringSoon > 0) {
        this.logger.warn('Content expiring soon detected', {
          expiringSoon: stats.expiringSoon,
          platformBreakdown: stats.platformBreakdown,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Daily expired content cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async rollingWindowCleanup(): Promise<void> {
    try {
      this.logger.log('Starting rolling window cleanup for non-consented creators');

      const result = await this.contentService.batchCleanupNonConsentedData();

      this.logger.log('Rolling window cleanup completed', {
        processedCreators: result.processedCreators,
        totalDeleted: result.totalDeleted,
        totalRetained: result.totalRetained,
        errors: result.errors,
        successRate:
          result.processedCreators > 0
            ? (
                ((result.processedCreators - result.errors) / result.processedCreators) *
                100
              ).toFixed(1) + '%'
            : '100%',
      });

      // 에러가 많이 발생한 경우 경고 로깅
      if (result.errors > result.processedCreators * 0.1) {
        this.logger.warn('High error rate during rolling window cleanup', {
          errorRate: ((result.errors / result.processedCreators) * 100).toFixed(1) + '%',
          totalErrors: result.errors,
          totalProcessed: result.processedCreators,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Rolling window cleanup job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async monitorQuotaUsage(): Promise<void> {
    try {
      this.logger.log('Starting hourly quota usage monitoring');

      const quotaSummary = await this.quotaMonitorService.getQuotaSummary();

      // YouTube 쿼터 모니터링
      if (quotaSummary.youtube) {
        const youtube = quotaSummary.youtube;

        if (youtube.warningLevel === 'critical') {
          this.logger.error('CRITICAL: YouTube API quota usage is critical', {
            usagePercentage: youtube.usagePercentage.toFixed(1) + '%',
            totalUnits: youtube.totalUnits,
            remainingQuota: 10000 - youtube.totalUnits,
            errorCount: youtube.errorCount,
            totalRequests: youtube.totalRequests,
          });
        } else if (youtube.warningLevel === 'warning') {
          this.logger.warn('WARNING: YouTube API quota usage is high', {
            usagePercentage: youtube.usagePercentage.toFixed(1) + '%',
            totalUnits: youtube.totalUnits,
            remainingQuota: 10000 - youtube.totalUnits,
            errorCount: youtube.errorCount,
            totalRequests: youtube.totalRequests,
          });
        } else {
          this.logger.debug('YouTube API quota usage is normal', {
            usagePercentage: youtube.usagePercentage.toFixed(1) + '%',
            totalUnits: youtube.totalUnits,
            totalRequests: youtube.totalRequests,
          });
        }
      }

      // Twitter 쿼터 모니터링
      if (quotaSummary.twitter) {
        const twitter = quotaSummary.twitter;

        if (twitter.warningLevel === 'critical') {
          this.logger.error('CRITICAL: Twitter API quota usage is critical', {
            usagePercentage: twitter.usagePercentage.toFixed(1) + '%',
            totalRequests: twitter.totalRequests,
            errorCount: twitter.errorCount,
          });
        } else if (twitter.warningLevel === 'warning') {
          this.logger.warn('WARNING: Twitter API quota usage is high', {
            usagePercentage: twitter.usagePercentage.toFixed(1) + '%',
            totalRequests: twitter.totalRequests,
            errorCount: twitter.errorCount,
          });
        }
      }

      this.logger.log('Quota usage monitoring completed', {
        totalRecords: quotaSummary.totalRecords,
        youtubeStatus: quotaSummary.youtube?.warningLevel || 'no_data',
        twitterStatus: quotaSummary.twitter?.warningLevel || 'no_data',
      });
    } catch (error: unknown) {
      this.logger.error('Quota usage monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldQuotaRecords(): Promise<void> {
    try {
      this.logger.log('Starting cleanup of old quota records');

      const result = await this.quotaMonitorService.cleanupOldQuotaRecords();

      this.logger.log('Old quota records cleanup completed', {
        deletedCount: result.deletedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Old quota records cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncTwitterContent(): Promise<void> {
    if (this.isTwitterSyncRunning) {
      this.logger.warn('Twitter sync already running, skipping');
      return;
    }

    this.isTwitterSyncRunning = true;

    try {
      this.logger.log('Starting Twitter content synchronization');

      const twitterPlatforms = await this.creatorPlatformService.findActiveTwitterPlatformsForSync();

      this.logger.debug('Found Twitter platforms to sync', {
        count: twitterPlatforms.length,
      });

      let totalSynced = 0;
      let totalErrors = 0;

      for (const platform of twitterPlatforms) {
        try {
          const syncedCount = await this.syncTwitterUserContent(platform);
          totalSynced += syncedCount;

          // 플랫폼 통계 업데이트
          await this.updateTwitterUserInfo(platform);

          // 플랫폼 동기화 상태 업데이트
          await this.creatorPlatformService.updateSyncStatus(platform.id, {
            lastSyncAt: new Date(),
            syncStatus: SyncStatus.ACTIVE,
          });

          this.logger.debug('Twitter user synced successfully', {
            creatorId: platform.creatorId,
            username: platform.platformId,
            syncedCount,
          });
        } catch (error: unknown) {
          totalErrors++;

          // 에러 상태로 업데이트
          await this.creatorPlatformService.updateSyncStatus(platform.id, {
            lastSyncAt: new Date(),
            syncStatus: SyncStatus.ERROR,
          });

          this.logger.error('Twitter user sync failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId: platform.creatorId,
            username: platform.platformId,
          });
        }

        // API 레이트 리미팅을 위한 지연
        await this.delay(2000);
      }

      this.logger.log('Twitter content synchronization completed', {
        totalPlatforms: twitterPlatforms.length,
        totalSynced,
        totalErrors,
      });
    } catch (error: unknown) {
      this.logger.error('Twitter sync job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isTwitterSyncRunning = false;
    }
  }

  // ==================== PUBLIC METHODS ====================

  async syncCreatorPlatformContent(
    creatorId: string,
    platformType: 'youtube' | 'twitter'
  ): Promise<number> {
    try {
      this.logger.log('Manual platform content sync requested', {
        creatorId,
        platformType,
      });

      const platform = await this.creatorPlatformService.findByCreatorIdAndType(
        creatorId,
        platformType as PlatformType,
        true // includeCreator
      );

      if (!platform) {
        throw ExternalApiException.platformNotFound();
      }

      let syncedCount = 0;

      if (platformType === 'youtube') {
        // YouTube는 상태별 동기화 로직 사용
        switch (platform.videoSyncStatus) {
          case VideoSyncStatus.NEVER_SYNCED:
          case VideoSyncStatus.CONSENT_CHANGED:
            syncedCount = await this.performFullSync(platform);
            break;
          case VideoSyncStatus.INCREMENTAL:
            syncedCount = await this.performIncrementalSync(platform);
            break;
          default:
            syncedCount = 0;
        }
      } else if (platformType === 'twitter') {
        syncedCount = await this.syncTwitterUserContent(platform);
      }

      // 플랫폼 동기화 상태 업데이트
      await this.creatorPlatformService.updateSyncStatus(platform.id, {
        lastSyncAt: new Date(),
        syncStatus: SyncStatus.ACTIVE,
      });

      this.logger.log('Manual platform sync completed', {
        creatorId,
        platformType,
        syncedCount,
      });

      return syncedCount;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Manual platform sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType,
      });
      throw ExternalApiException.dataSyncError();
    }
  }

  async refreshCreatorPlatformData(creatorId: string): Promise<void> {
    try {
      this.logger.log('Refreshing creator platform data', { creatorId });

      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);

      for (const platform of platforms) {
        try {
          if (platform.type === 'youtube') {
            await this.updateYouTubeChannelInfo(platform);
          } else if (platform.type === 'twitter') {
            await this.updateTwitterUserInfo(platform);
          }

          this.logger.debug('Platform data refreshed', {
            creatorId,
            platformType: platform.type,
            platformId: platform.platformId,
          });
        } catch (error: unknown) {
          this.logger.warn('Platform data refresh failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId,
            platformType: platform.type,
            platformId: platform.platformId,
          });
        }
      }

      this.logger.log('Creator platform data refresh completed', { creatorId });
    } catch (error: unknown) {
      this.logger.error('Creator platform data refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ExternalApiException.dataSyncError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 전체 동기화 수행 (NEVER_SYNCED, CONSENT_CHANGED)
   */
  private async performFullSync(platform: CreatorPlatformEntity): Promise<number> {
    let syncedCount = 0;
    let nextPageToken: string | undefined;
    let totalProcessed = 0;

    // 동기화 상태를 진행중으로 변경
    await this.creatorPlatformService.updateSyncStatus(platform.id, {
      videoSyncStatus: VideoSyncStatus.INITIAL_SYNCING,
      lastVideoSyncAt: new Date(),
    });

    this.logger.debug('Starting full sync for platform', {
      platformId: platform.id,
      channelId: platform.platformId,
      currentStatus: platform.videoSyncStatus,
    });

    try {
      do {
        const result = await this.youtubeApiService.getChannelVideosInitial(
          platform.platformId,
          nextPageToken
        );

        for (const video of result.videos) {
          try {
            const existingContent = await this.contentService.findByPlatformId(video.id, 'youtube');

            if (!existingContent) {
              const creator = await this.creatorService.findById(platform.creatorId);
              const hasConsent = creator?.hasDataConsent || false;

              const now = new Date();
              const expiresAt = hasConsent
                ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
                : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

              const createDto: CreateContentDto = {
                type: ContentType.YOUTUBE_VIDEO,
                title: video.title,
                description: video.description || '',
                thumbnail:
                  video.thumbnails.high || video.thumbnails.medium || video.thumbnails.default || '',
                url: video.url,
                platform: 'youtube',
                platformId: video.id,
                duration: video.duration,
                publishedAt: video.publishedAt.toISOString(),
                creatorId: platform.creatorId,
                metadata: {
                  tags: video.tags,
                  category: video.categoryId || 'general',
                  language: video.defaultLanguage || 'en',
                  isLive: video.liveBroadcastContent === 'live',
                  quality: 'hd',
                },
                expiresAt: expiresAt.toISOString(),
                lastSyncedAt: now.toISOString(),
                isAuthorizedData: hasConsent,
              };

              await this.contentService.createContent(createDto);
              syncedCount++;
            } else {
              await this.contentService.updateContentStatistics(existingContent.id, {
                views: video.statistics.viewCount,
                likes: video.statistics.likeCount,
                comments: video.statistics.commentCount,
              });
              await this.contentService.refreshContentData(existingContent.id);
            }

            totalProcessed++;
          } catch (error: unknown) {
            this.logger.warn('Failed to process video in full sync', {
              error: error instanceof Error ? error.message : 'Unknown error',
              videoId: video.id,
              platformId: platform.id,
            });
          }
        }

        nextPageToken = result.nextPageToken;

        // 플랫폼 동기화 진행률 업데이트
        await this.creatorPlatformService.updateSyncStatus(platform.id, {
          syncedVideoCount: totalProcessed,
          totalVideoCount: result.totalResults,
          lastVideoSyncAt: new Date(),
        });

        // API 레이트 리미팅
        if (nextPageToken) {
          await this.delay(1500);
        }
      } while (nextPageToken);

      // 전체 동기화 완료 - 증분 모드로 전환
      await this.creatorPlatformService.updateSyncStatus(platform.id, {
        videoSyncStatus: VideoSyncStatus.INCREMENTAL,
        syncStatus: SyncStatus.ACTIVE,
        lastVideoSyncAt: new Date(),
        syncedVideoCount: totalProcessed,
      });

      this.logger.debug('Full sync completed successfully', {
        platformId: platform.id,
        channelId: platform.platformId,
        totalProcessed,
        syncedCount,
      });

      return syncedCount;
    } catch (error: unknown) {
      // 동기화 실패 시 상태 업데이트
      await this.creatorPlatformService.updateSyncStatus(platform.id, {
        syncStatus: SyncStatus.ERROR,
        lastVideoSyncAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * 증분 동기화 수행 (INCREMENTAL)
   */
  private async performIncrementalSync(platform: CreatorPlatformEntity): Promise<number> {
    let syncedCount = 0;

    // 마지막 동기화 시점부터 새 영상만 조회
    const publishedAfter =
      platform.lastVideoSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 기본 7일

    this.logger.debug('Starting incremental sync for platform', {
      platformId: platform.id,
      channelId: platform.platformId,
      publishedAfter: publishedAfter.toISOString(),
    });

    try {
      const result = await this.youtubeApiService.getChannelVideosIncremental(
        platform.platformId,
        publishedAfter
      );

      if (result.videos.length === 0) {
        this.logger.debug('No new videos found in incremental sync', {
          platformId: platform.id,
          channelId: platform.platformId,
        });
      }

      for (const video of result.videos) {
        try {
          const existingContent = await this.contentService.findByPlatformId(video.id, 'youtube');

          if (!existingContent) {
            const creator = await this.creatorService.findById(platform.creatorId);
            const hasConsent = creator?.hasDataConsent || false;

            const now = new Date();
            const expiresAt = hasConsent
              ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const createDto: CreateContentDto = {
              type: ContentType.YOUTUBE_VIDEO,
              title: video.title,
              description: video.description,
              thumbnail:
                video.thumbnails.high || video.thumbnails.medium || video.thumbnails.default || '',
              url: video.url,
              platform: 'youtube',
              platformId: video.id,
              duration: video.duration,
              publishedAt: video.publishedAt.toISOString(),
              creatorId: platform.creatorId,
              metadata: {
                tags: video.tags,
                category: video.categoryId || 'general',
                language: video.defaultLanguage || 'en',
                isLive: video.liveBroadcastContent === 'live',
                quality: 'hd',
              },
              lastSyncedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
              isAuthorizedData: hasConsent,
            };

            await this.contentService.createContent(createDto);
            syncedCount++;

            this.logger.debug('New video found in incremental sync', {
              videoId: video.id,
              title: video.title,
              platformId: platform.id,
            });
          } else {
            // 기존 영상 통계 업데이트
            await this.contentService.updateContentStatistics(existingContent.id, {
              views: video.statistics.viewCount,
              likes: video.statistics.likeCount,
              comments: video.statistics.commentCount,
            });
            await this.contentService.refreshContentData(existingContent.id);
          }
        } catch (error: unknown) {
          this.logger.warn('Failed to process video in incremental sync', {
            error: error instanceof Error ? error.message : 'Unknown error',
            videoId: video.id,
            platformId: platform.id,
          });
        }
      }

      // 증분 동기화 완료 시점 업데이트
      await this.creatorPlatformService.updateSyncStatus(platform.id, {
        lastVideoSyncAt: new Date(),
        syncStatus: SyncStatus.ACTIVE,
        syncedVideoCount: (platform.syncedVideoCount || 0) + syncedCount,
      });

      this.logger.debug('Incremental sync completed successfully', {
        platformId: platform.id,
        channelId: platform.platformId,
        newVideosFound: result.videos.length,
        syncedCount,
      });

      return syncedCount;
    } catch (error: unknown) {
      await this.creatorPlatformService.updateSyncStatus(platform.id, {
        syncStatus: SyncStatus.ERROR,
        lastVideoSyncAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * 채널 정보 업데이트 필요 여부 판단
   */
  private shouldUpdateChannelInfo(platform: CreatorPlatformEntity): boolean {
    if (!platform.lastSyncAt) {
      return true; // 처음 동기화하는 경우
    }

    // 24시간마다 채널 정보 업데이트
    const hoursSinceLastSync = (Date.now() - platform.lastSyncAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastSync >= 24;
  }

  private async syncTwitterUserContent(platform: CreatorPlatformEntity): Promise<number> {
    let syncedCount = 0;
    let nextToken: string | undefined;

    // Twitter username에서 @ 제거
    const username = platform.platformId.replace('@', '');

    // 사용자 정보 먼저 가져오기
    const twitterUser = await this.twitterApiService.getUserByUsername(username);
    if (!twitterUser) {
      throw ExternalApiException.userNotFound();
    }

    do {
      const result = await this.twitterApiService.getUserTweets(
        twitterUser.id,
        100, // 한 번에 100개씩
        nextToken
      );

      for (const tweet of result.tweets) {
        try {
          // 이미 존재하는 콘텐츠인지 확인
          const existingContent = await this.contentService.findByPlatformId(tweet.id, 'twitter');

          if (!existingContent) {
            // 크리에이터 동의 상태 확인
            const creator = await this.creatorService.findById(platform.creatorId);
            const hasConsent = creator?.hasDataConsent || false;

            // 새로운 콘텐츠 생성 (Twitter API 정책: 동의 여부에 따른 차별 처리)
            const now = new Date();
            const expiresAt = hasConsent
              ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 동의한 경우: 1년 (장기 보존)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 비동의: 30일 후

            const createDto: CreateContentDto = {
              type: ContentType.TWITTER_POST,
              title: this.generateTweetTitle(tweet.text),
              description: tweet.text,
              thumbnail:
                tweet.attachments.media[0]?.previewImageUrl ||
                tweet.author?.profileImageUrl ||
                'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
              url: tweet.url,
              platform: 'twitter',
              platformId: tweet.id,
              publishedAt: tweet.createdAt.toISOString(),
              creatorId: platform.creatorId,
              metadata: {
                tags: tweet.entities.hashtags.map((tag) => tag.tag),
                category: 'social',
                language: tweet.lang || 'en',
                isLive: false,
                quality: 'hd',
              },
              lastSyncedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
              isAuthorizedData: hasConsent, // 동의 여부에 따른 인증 데이터 플래그
            };

            await this.contentService.createContent(createDto);
            syncedCount++;

            this.logger.debug('New tweet synced', {
              tweetId: tweet.id,
              text: tweet.text.substring(0, 50) + '...',
              creatorId: platform.creatorId,
              hasCreatorConsent: hasConsent,
              isAuthorizedData: hasConsent,
              expiresAt: expiresAt.toISOString(),
            });
          } else {
            // 기존 콘텐츠 통계 업데이트 및 동기화 시간 갱신
            await this.contentService.updateContentStatistics(existingContent.id, {
              views: 0, // Twitter는 조회수 제공하지 않음
              likes: tweet.publicMetrics.likeCount,
              comments: tweet.publicMetrics.replyCount,
              shares: tweet.publicMetrics.retweetCount,
            });

            // 동기화 시간 갱신 (Twitter API 정책 준수)
            await this.contentService.refreshContentData(existingContent.id);
          }
        } catch (error: unknown) {
          this.logger.warn('Failed to sync tweet', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tweetId: tweet.id,
            creatorId: platform.creatorId,
          });
        }
      }

      nextToken = result.nextToken;

      // API 레이트 리미팅을 위한 지연
      if (nextToken) {
        await this.delay(2000);
      }
    } while (nextToken);

    return syncedCount;
  }

  private async updateYouTubeChannelInfo(platform: CreatorPlatformEntity): Promise<void> {
    const channelInfo = await this.youtubeApiService.getChannelInfo(platform.platformId);
    if (channelInfo) {
      await this.creatorPlatformService.updateStatistics(platform.id, {
        followerCount: channelInfo.statistics.subscriberCount,
        contentCount: channelInfo.statistics.videoCount,
        totalViews: channelInfo.statistics.viewCount,
      });
    }
  }

  private async updateTwitterUserInfo(platform: CreatorPlatformEntity): Promise<void> {
    const username = platform.platformId.replace('@', '');
    const userInfo = await this.twitterApiService.getUserByUsername(username);
    if (userInfo) {
      // Twitter API를 통해 실제 트윗 수 계산
      const tweetsResult = await this.twitterApiService.getUserTweets(userInfo.id, 100);
      const contentCount = tweetsResult.resultCount || 0;

      await this.creatorPlatformService.updateStatistics(platform.id, {
        followerCount: userInfo.publicMetrics.followersCount,
        contentCount,
        totalViews: 0, // Twitter API는 총 조회수를 제공하지 않음
      });
    }
  }

  private generateTweetTitle(text: string): string {
    // 트윗 텍스트에서 제목 생성 (최대 100자)
    const cleanText = text
      .replace(/https?:\/\/[^\s]+/g, '') // URL 제거
      .replace(/@\w+/g, '') // 멘션 제거
      .replace(/#\w+/g, '') // 해시태그 제거
      .trim();

    if (cleanText.length <= 100) {
      return cleanText || 'Tweet';
    }

    return cleanText.substring(0, 97) + '...';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

