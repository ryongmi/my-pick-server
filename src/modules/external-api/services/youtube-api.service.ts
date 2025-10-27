import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { lastValueFrom, map } from 'rxjs';

import { transformAndValidate } from '@krgeobuk/core/utils';

import { ExternalApiException } from '../exceptions/index.js';
import { ApiProvider, ApiOperation } from '../enums/index.js';
import { YouTubeChannelDto, YouTubeVideoDto } from '../dto/index.js';

import { QuotaMonitorService } from './quota-monitor.service.js';

// YouTube API 응답 타입 정의 (inline)
interface YouTubeVideoApiData {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
      standard?: { url: string };
      maxres?: { url: string };
    };
    tags?: string[];
    categoryId?: string;
    liveBroadcastContent?: string;
    defaultLanguage?: string;
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration: string;
  };
}

interface YouTubeChannelApiData {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics: {
    viewCount: string;
    subscriberCount: string;
    videoCount: string;
  };
  brandingSettings?: {
    image?: {
      bannerExternalUrl?: string;
    };
    channel?: {
      keywords?: string;
      country?: string;
    };
  };
}

@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly quotaMonitor: QuotaMonitorService
  ) {
    this.apiKey = this.configService.get<string>('youtube.youtubeApiKey')!;

    if (!this.apiKey) {
      this.logger.error('YouTube API key not configured');
      throw new Error('YouTube API key is required');
    }
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * 채널 정보 조회
   */
  async getChannelInfo(channelId: string): Promise<YouTubeChannelDto | null> {
    try {
      this.logger.debug(`Fetching YouTube channel info: ${channelId}`);

      // 할당량 체크
      const quotaCheck = await this.quotaMonitor.canUseQuota(ApiProvider.YOUTUBE, 1);
      if (!quotaCheck.canUse) {
        this.logger.warn('YouTube API quota limit reached', {
          currentUsage: quotaCheck.currentUsage,
          remainingQuota: quotaCheck.remainingQuota,
        });
        throw ExternalApiException.quotaExceeded();
      }

      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/channels`, {
            params: {
              key: this.apiKey,
              id: channelId,
              part: 'snippet,statistics,brandingSettings',
            },
          })
          .pipe(map((res) => res.data))
      );

      // 할당량 기록
      await this.quotaMonitor.recordQuotaUsage(
        ApiProvider.YOUTUBE,
        ApiOperation.CHANNEL_INFO,
        1,
        { channelId },
        '200'
      );

      if (!response.items || response.items.length === 0) {
        this.logger.warn(`YouTube channel not found: ${channelId}`);
        return null;
      }

      const channel: YouTubeChannelApiData = response.items[0];

      // DTO 변환 및 검증 (1회만)
      const channelDto = await transformAndValidate<YouTubeChannelDto>({
        cls: YouTubeChannelDto,
        plain: {
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          customUrl: channel.snippet.customUrl,
          publishedAt: new Date(channel.snippet.publishedAt),
          thumbnails: {
            default: channel.snippet.thumbnails.default?.url || null,
            medium: channel.snippet.thumbnails.medium?.url || null,
            high: channel.snippet.thumbnails.high?.url || null,
          },
          statistics: {
            viewCount: parseInt(channel.statistics.viewCount || '0'),
            subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
            videoCount: parseInt(channel.statistics.videoCount || '0'),
          },
          brandingSettings: {
            bannerImageUrl: channel.brandingSettings?.image?.bannerExternalUrl,
            keywords: channel.brandingSettings?.channel?.keywords,
            country: channel.brandingSettings?.channel?.country,
          },
        },
      });

      this.logger.debug(`YouTube channel info fetched: ${channelId}`);

      return channelDto;
    } catch (error: unknown) {
      // 에러 발생 시 할당량 기록
      await this.quotaMonitor
        .recordQuotaUsage(
          ApiProvider.YOUTUBE,
          ApiOperation.CHANNEL_INFO,
          1,
          { channelId },
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
        .catch(() => {});

      if (error instanceof Error && error.message.includes('quota')) {
        throw error;
      }

      this.logger.error(`Failed to fetch channel info: ${channelId}`, error);
      throw ExternalApiException.youtubeApiError();
    }
  }

  /**
   * 채널 영상 목록 조회 (증분 동기화 지원)
   */
  async getChannelVideos(
    channelId: string,
    options: {
      maxResults: number;
      pageToken?: string;
      publishedAfter?: Date;
    }
  ): Promise<{
    videos: YouTubeVideoDto[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    const { maxResults, pageToken, publishedAfter } = options || {};

    try {
      this.logger.debug(`Fetching YouTube channel videos: ${channelId}`);

      // 할당량 체크 (playlistItems 1 + videos 1 = 2)
      const quotaCheck = await this.quotaMonitor.canUseQuota(ApiProvider.YOUTUBE, 2);
      if (!quotaCheck.canUse) {
        this.logger.warn('YouTube API quota limit reached for channel videos');
        throw ExternalApiException.quotaExceeded();
      }

      // 1. 업로드 플레이리스트 ID
      const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
      if (!uploadsPlaylistId) {
        return { videos: [], totalResults: 0 };
      }

      // 2. 플레이리스트 아이템 조회
      const params: Record<string, string | number> = {
        key: this.apiKey,
        playlistId: uploadsPlaylistId,
        part: 'snippet',
        maxResults,
        order: 'date',
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }
      if (publishedAfter) {
        params.publishedAfter = publishedAfter.toISOString();
      }

      const playlistResponse = await lastValueFrom(
        this.httpService.get(`${this.baseUrl}/playlistItems`, { params }).pipe(map((r) => r.data))
      );

      const videoIds = playlistResponse.items
        .map(
          (item: { snippet: { resourceId: { videoId: string } } }) =>
            item.snippet.resourceId.videoId
        )
        .filter(Boolean);

      if (videoIds.length === 0) {
        return { videos: [], totalResults: 0 };
      }

      // 3. 비디오 상세 정보
      const videosResponse = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/videos`, {
            params: {
              key: this.apiKey,
              id: videoIds.join(','),
              part: 'snippet,statistics,contentDetails',
            },
          })
          .pipe(map((r) => r.data))
      );

      const videos = await Promise.all(
        videosResponse.items.map((video: YouTubeVideoApiData) => this.transformVideoData(video))
      );

      // 할당량 기록
      await this.quotaMonitor.recordQuotaUsage(
        ApiProvider.YOUTUBE,
        ApiOperation.CHANNEL_VIDEOS,
        2,
        { channelId, maxResults, videoCount: videos.length },
        '200'
      );

      this.logger.debug(`YouTube channel videos fetched: ${channelId} (${videos.length} videos)`);

      return {
        videos,
        nextPageToken: playlistResponse.nextPageToken,
        totalResults: playlistResponse.pageInfo.totalResults,
      };
    } catch (error: unknown) {
      // 에러 발생 시 할당량 기록
      await this.quotaMonitor
        .recordQuotaUsage(
          ApiProvider.YOUTUBE,
          ApiOperation.CHANNEL_VIDEOS,
          2,
          { channelId, maxResults },
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
        .catch(() => {});

      if (error instanceof Error && error.message.includes('quota')) {
        throw error;
      }

      this.logger.error(`Failed to fetch channel videos: ${channelId}`, error);
      throw ExternalApiException.youtubeApiError();
    }
  }

  /**
   * 비디오 상세 조회
   */
  async getVideoById(videoId: string): Promise<YouTubeVideoDto | null> {
    try {
      this.logger.debug(`Fetching YouTube video: ${videoId}`);

      const quotaCheck = await this.quotaMonitor.canUseQuota(ApiProvider.YOUTUBE, 1);
      if (!quotaCheck.canUse) {
        throw ExternalApiException.quotaExceeded();
      }

      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/videos`, {
            params: {
              key: this.apiKey,
              id: videoId,
              part: 'snippet,statistics,contentDetails',
            },
          })
          .pipe(map((r) => r.data))
      );

      await this.quotaMonitor.recordQuotaUsage(
        ApiProvider.YOUTUBE,
        ApiOperation.VIDEO_DETAILS,
        1,
        { videoId },
        '200'
      );

      if (!response.items || response.items.length === 0) {
        this.logger.warn(`YouTube video not found: ${videoId}`);
        return null;
      }

      return this.transformVideoData(response.items[0]);
    } catch (error: unknown) {
      await this.quotaMonitor
        .recordQuotaUsage(
          ApiProvider.YOUTUBE,
          ApiOperation.VIDEO_DETAILS,
          1,
          { videoId },
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
        .catch(() => {});

      if (error instanceof Error && error.message.includes('quota')) {
        throw error;
      }

      this.logger.error(`Failed to fetch video: ${videoId}`, error);
      throw ExternalApiException.youtubeApiError();
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async getUploadsPlaylistId(channelId: string): Promise<string | null> {
    try {
      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/channels`, {
            params: {
              key: this.apiKey,
              id: channelId,
              part: 'contentDetails',
            },
          })
          .pipe(map((r) => r.data))
      );

      if (!response.items || response.items.length === 0) {
        this.logger.warn(`YouTube channel content not found: ${channelId}`);
        return null;
      }

      return response.items[0].contentDetails.relatedPlaylists.uploads || null;
    } catch (error: unknown) {
      this.logger.warn(`Failed to get uploads playlist: ${channelId}`);
      return null;
    }
  }

  private async transformVideoData(video: YouTubeVideoApiData): Promise<YouTubeVideoDto> {
    try {
      const duration = this.parseDuration(video.contentDetails.duration);

      return await transformAndValidate<YouTubeVideoDto>({
        cls: YouTubeVideoDto,
        plain: {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          publishedAt: new Date(video.snippet.publishedAt),
          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,
          thumbnails: {
            default: video.snippet.thumbnails.default?.url,
            medium: video.snippet.thumbnails.medium?.url,
            high: video.snippet.thumbnails.high?.url,
            standard: video.snippet.thumbnails.standard?.url,
            maxres: video.snippet.thumbnails.maxres?.url,
          },
          statistics: {
            viewCount: parseInt(video.statistics.viewCount || '0'),
            likeCount: parseInt(video.statistics.likeCount || '0'),
            commentCount: parseInt(video.statistics.commentCount || '0'),
          },
          duration,
          tags: video.snippet.tags || [],
          categoryId: video.snippet.categoryId,
          liveBroadcastContent: video.snippet.liveBroadcastContent,
          defaultLanguage: video.snippet.defaultLanguage,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        },
      });
    } catch (error: unknown) {
      this.logger.error('YouTube video data validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId: video.id,
      });
      throw ExternalApiException.youtubeApiValidationError();
    }
  }

  private parseDuration(isoDuration: string): number {
    // PT4M13S -> 253 seconds
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }
}
