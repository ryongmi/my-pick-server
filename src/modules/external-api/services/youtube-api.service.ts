import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { lastValueFrom, map } from 'rxjs';

import { transformAndValidate } from '@krgeobuk/core/utils';

import { ExternalApiException } from '../exceptions/index.js';
import { ApiProvider, ApiOperation } from '../enums/index.js';
import {
  YouTubeChannelDto,
  YouTubeVideoDto,
  YouTubePlaylistDto,
  YouTubeSearchResultDto,
  YouTubeChannelsApiResponseDto,
  YouTubeChannelContentApiResponseDto,
  YouTubeChannelFullApiResponseDto,
  YouTubeSearchApiResponseDto,
} from '../dto/index.js';

import { QuotaMonitorService } from './quota-monitor.service.js';

// YouTube API 응답 타입 정의
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

@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly quotaMonitorService: QuotaMonitorService
  ) {
    this.apiKey = this.configService.get<string>('YOUTUBE_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.error('YouTube API key not configured');
      throw new Error('YouTube API key is required');
    }
  }

  // ==================== PUBLIC METHODS ====================

  async getChannelInfo(channelId: string): Promise<YouTubeChannelDto | null> {
    try {
      this.logger.debug('Fetching YouTube channel info', { channelId });

      // 쿼터 사용 가능 여부 체크
      const quotaCheck = await this.quotaMonitorService.canUseQuota(ApiProvider.YOUTUBE, 1);
      if (!quotaCheck.canUse) {
        this.logger.warn('YouTube API quota limit reached', {
          currentUsage: quotaCheck.currentUsage,
          remainingQuota: quotaCheck.remainingQuota,
          usagePercentage: quotaCheck.usagePercentage.toFixed(1) + '%',
        });
        throw ExternalApiException.quotaExceeded();
      }

      const requestDetails = { channelId, operation: 'channels' };
      const startTime = Date.now();

      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/channels`, {
            params: {
              key: this.apiKey,
              id: channelId,
              part: 'snippet,statistics,brandingSettings',
            },
          })
          .pipe(
            map((httpResponse) => ({
              data: httpResponse.data,
              status: httpResponse.status,
            }))
          )
      );

      const responseTime = Date.now() - startTime;

      // 쿼터 사용량 기록
      await this.quotaMonitorService.recordQuotaUsage(
        ApiProvider.YOUTUBE,
        ApiOperation.CHANNEL_INFO,
        1,
        { ...requestDetails, responseTime },
        response.status.toString()
      );

      this.logger.debug('YouTube channel info API 호출 성공', { channelId });

      // YouTube API 응답값 검증 및 변환
      const validatedResponse = await transformAndValidate<YouTubeChannelFullApiResponseDto>({
        cls: YouTubeChannelFullApiResponseDto,
        plain: response.data,
      });

      this.logger.debug('YouTube channel info API 응답 검증 성공', { channelId });

      if (!validatedResponse.items || validatedResponse.items.length === 0) {
        this.logger.warn('YouTube channel not found', { channelId });
        return null;
      }

      const channel = validatedResponse.items[0]!;

      // 검증된 데이터로 안전하게 DTO 생성
      const channelDto: YouTubeChannelDto = {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl || undefined,
        publishedAt: new Date(channel.snippet.publishedAt),
        thumbnails: {
          default: channel.snippet.thumbnails.default?.url,
          medium: channel.snippet.thumbnails.medium?.url,
          high: channel.snippet.thumbnails.high?.url,
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
      };

      this.logger.debug('YouTube channel info fetched successfully', {
        channelId,
        title: channelDto.title,
        subscriberCount: channelDto.statistics.subscriberCount,
      });

      return channelDto;
    } catch (error: unknown) {
      // 에러 발생 시 쿼터 사용량 기록 (에러 포함)
      await this.quotaMonitorService
        .recordQuotaUsage(
          ApiProvider.YOUTUBE,
          ApiOperation.CHANNEL_INFO,
          1,
          { channelId, operation: 'channels' },
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
        .catch(() => {}); // 쿼터 기록 실패는 무시

      if (error instanceof HttpException) {
        throw error;
      }

      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube channel data validation failed', {
          error: error.message,
          channelId,
          validationError: true,
        });
        throw ExternalApiException.youtubeApiValidationError();
      }

      this.logger.error('YouTube channel info fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId,
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  async getChannelByUsername(username: string): Promise<YouTubeChannelDto | null> {
    try {
      this.logger.debug('Fetching YouTube channel by username', { username });

      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/channels`, {
            params: {
              key: this.apiKey,
              forUsername: username,
              part: 'snippet,statistics,brandingSettings',
            },
          })
          .pipe(map((response) => response.data))
      );

      this.logger.debug('YouTube channel by username API 호출 성공', { username });

      // 응답값 검증 및 변환
      const channelsResponse = await transformAndValidate<YouTubeChannelsApiResponseDto>({
        cls: YouTubeChannelsApiResponseDto,
        plain: response,
      });

      this.logger.debug('YouTube channel by username API 응답 검증 성공', { username });

      if (!channelsResponse.items || channelsResponse.items.length === 0) {
        this.logger.warn('YouTube channel not found by username', { username });
        return null;
      }

      const channel = channelsResponse.items[0]!;
      return this.getChannelInfo(channel.id);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube channel by username validation failed', {
          error: error.message,
          username,
          validationError: true,
        });
        throw ExternalApiException.youtubeApiValidationError();
      }

      this.logger.error('YouTube channel fetch by username failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        username,
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  async getChannelVideos(
    channelId: string,
    maxResults = 50,
    pageToken?: string,
    publishedAfter?: Date
  ): Promise<{
    videos: YouTubeVideoDto[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    try {
      this.logger.debug('Fetching YouTube channel videos', {
        channelId,
        maxResults,
        hasPageToken: !!pageToken,
        hasPublishedAfter: !!publishedAfter,
      });

      // 쿼터 사용량 계산 (playlistItems 1 + videos 1 = 총 2 유닛)
      const totalQuotaUnits = 2;
      const quotaCheck = await this.quotaMonitorService.canUseQuota(ApiProvider.YOUTUBE, totalQuotaUnits);
      if (!quotaCheck.canUse) {
        this.logger.warn('YouTube API quota limit reached for channel videos', {
          channelId,
          requiredUnits: totalQuotaUnits,
          currentUsage: quotaCheck.currentUsage,
          remainingQuota: quotaCheck.remainingQuota,
        });
        throw ExternalApiException.quotaExceeded();
      }

      const requestDetails = {
        channelId,
        maxResults,
        hasPageToken: !!pageToken,
        hasPublishedAfter: !!publishedAfter,
        operation: 'channelVideos',
      };
      const startTime = Date.now();

      // 1. 채널의 업로드 플레이리스트 ID 가져오기
      const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
      if (!uploadsPlaylistId) {
        return { videos: [], totalResults: 0 };
      }

      // 2. 플레이리스트에서 비디오 목록 가져오기 (증분 동기화 지원)
      const params: {
        key: string;
        playlistId: string;
        part: string;
        maxResults: number;
        pageToken?: string;
        order: string;
        publishedAfter?: string;
      } = {
        key: this.apiKey,
        playlistId: uploadsPlaylistId,
        part: 'snippet',
        maxResults,
        order: 'date',
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      // 증분 동기화를 위한 publishedAfter 필터 추가
      if (publishedAfter) {
        params.publishedAfter = publishedAfter.toISOString();
      }

      const playlistResponse = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/playlistItems`, { params })
          .pipe(map((response) => response.data))
      );

      interface PlaylistItem {
        snippet: {
          resourceId: {
            videoId: string;
          };
        };
      }

      const videoIds = (playlistResponse.items as PlaylistItem[])
        .map((item) => item.snippet.resourceId.videoId)
        .filter(Boolean);

      if (videoIds.length === 0) {
        return { videos: [], totalResults: 0 };
      }

      // 3. 비디오 상세 정보 가져오기
      const videosResponse = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/videos`, {
            params: {
              key: this.apiKey,
              id: videoIds.join(','),
              part: 'snippet,statistics,contentDetails',
            },
          })
          .pipe(map((response) => response.data))
      );

      const videos = await Promise.all(
        videosResponse.items.map((video: YouTubeVideoApiData) => this.transformVideoData(video))
      );

      const responseTime = Date.now() - startTime;

      // 쿼터 사용량 기록 (성공)
      await this.quotaMonitorService.recordQuotaUsage(
        ApiProvider.YOUTUBE,
        ApiOperation.CHANNEL_VIDEOS,
        totalQuotaUnits,
        { ...requestDetails, responseTime, videoCount: videos.length },
        '200'
      );

      this.logger.debug('YouTube channel videos fetched successfully', {
        channelId,
        videoCount: videos.length,
        totalResults: playlistResponse.pageInfo.totalResults,
        quotaUnits: totalQuotaUnits,
        responseTime,
      });

      return {
        videos,
        nextPageToken: playlistResponse.nextPageToken,
        totalResults: playlistResponse.pageInfo.totalResults,
      };
    } catch (error: unknown) {
      // 에러 발생 시 쿼터 사용량 기록 (에러 포함)
      await this.quotaMonitorService
        .recordQuotaUsage(
          ApiProvider.YOUTUBE,
          ApiOperation.CHANNEL_VIDEOS,
          2, // 실패했어도 쿼터는 소모됨
          { channelId, maxResults, operation: 'channelVideos' },
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )
        .catch(() => {}); // 쿼터 기록 실패는 무시

      if (error instanceof HttpException) {
        throw error;
      }

      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube channel videos validation failed', {
          error: error.message,
          channelId,
          maxResults,
          validationError: true,
        });
        throw ExternalApiException.youtubeApiValidationError();
      }

      this.logger.error('YouTube channel videos fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId,
        maxResults,
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  async getVideoById(videoId: string): Promise<YouTubeVideoDto | null> {
    try {
      this.logger.debug('Fetching YouTube video by ID', { videoId });

      const response = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/videos`, {
            params: {
              key: this.apiKey,
              id: videoId,
              part: 'snippet,statistics,contentDetails',
            },
          })
          .pipe(map((response) => response.data))
      );

      if (!response.items || response.items.length === 0) {
        this.logger.warn('YouTube video not found', { videoId });
        return null;
      }

      const video = await this.transformVideoData(response.items[0]);

      this.logger.debug('YouTube video fetched successfully', {
        videoId,
        title: video.title,
        views: video.statistics.viewCount,
      });

      return video;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube video data validation failed', {
          error: error.message,
          videoId,
          validationError: true,
        });
        throw ExternalApiException.youtubeApiValidationError();
      }

      this.logger.error('YouTube video fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  async searchVideos(
    query: string,
    maxResults = 25,
    pageToken?: string
  ): Promise<YouTubeSearchResultDto> {
    try {
      this.logger.debug('Searching YouTube videos', {
        query,
        maxResults,
        hasPageToken: !!pageToken,
      });

      const response = await lastValueFrom(
        this.httpService.get(`${this.baseUrl}/search`, {
          params: {
            key: this.apiKey,
            q: query,
            part: 'snippet',
            type: 'video',
            maxResults,
            pageToken,
            order: 'relevance',
          },
        })
      );

      this.logger.debug('YouTube search API 호출 성공', { query, maxResults });

      // 응답값 검증 및 변환
      const searchResponse = await transformAndValidate<YouTubeSearchApiResponseDto>({
        cls: YouTubeSearchApiResponseDto,
        plain: response.data,
      });

      this.logger.debug('YouTube search API 응답 검증 성공', { query, maxResults });

      const videoIds = searchResponse.items.map((item) => item.id.videoId).filter(Boolean);

      if (videoIds.length === 0) {
        return {
          videos: [],
          nextPageToken: searchResponse.nextPageToken || undefined,
          totalResults: 0,
        };
      }

      // 비디오 상세 정보 가져오기
      const videosResponse = await lastValueFrom(
        this.httpService
          .get(`${this.baseUrl}/videos`, {
            params: {
              key: this.apiKey,
              id: videoIds.join(','),
              part: 'snippet,statistics,contentDetails',
            },
          })
          .pipe(map((response) => response.data))
      );

      const videos = await Promise.all(
        videosResponse.items.map((video: YouTubeVideoApiData) => this.transformVideoData(video))
      );

      this.logger.debug('YouTube video search completed', {
        query,
        videoCount: videos.length,
        totalResults: searchResponse.pageInfo.totalResults,
      });

      return {
        videos,
        nextPageToken: searchResponse.nextPageToken,
        totalResults: searchResponse.pageInfo.totalResults,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube video search validation failed', {
          error: error.message,
          query,
          maxResults,
          validationError: true,
        });
        throw ExternalApiException.youtubeApiValidationError();
      }

      this.logger.error('YouTube video search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        maxResults,
      });
      throw ExternalApiException.youtubeApiError();
    }
  }

  // ==================== BATCH SIZE OPTIMIZATION ====================

  /**
   * 동기화 상태에 따른 최적 배치 크기 결정
   */
  getOptimalBatchSize(syncStatus: 'initial' | 'incremental'): number {
    switch (syncStatus) {
      case 'initial':
        return 50; // 초기 동기화 시 최대 효율
      case 'incremental':
        return 10; // 증분 동기화 시 쿼터 절약
      default:
        return 25; // 기본값
    }
  }

  /**
   * 증분 동기화용 채널 영상 조회 (publishedAfter 필터 적용)
   */
  async getChannelVideosIncremental(
    channelId: string,
    publishedAfter: Date,
    maxResults = 10
  ): Promise<{
    videos: YouTubeVideoDto[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    this.logger.debug('Performing incremental video sync', {
      channelId,
      publishedAfter: publishedAfter.toISOString(),
      maxResults,
    });

    return this.getChannelVideos(channelId, maxResults, undefined, publishedAfter);
  }

  /**
   * 전체 동기화용 채널 영상 조회 (큰 배치 크기)
   */
  async getChannelVideosInitial(
    channelId: string,
    pageToken?: string
  ): Promise<{
    videos: YouTubeVideoDto[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    const maxResults = this.getOptimalBatchSize('initial');

    this.logger.debug('Performing initial video sync', {
      channelId,
      maxResults,
      hasPageToken: !!pageToken,
    });

    return this.getChannelVideos(channelId, maxResults, pageToken);
  }

  // ==================== PRIVATE HELPER METHODS ====================

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
          .pipe(map((response) => response.data))
      );

      this.logger.debug('YouTube channel content API 호출 성공', { channelId });

      // 응답값 검증 및 변환
      const channelContentResponse =
        await transformAndValidate<YouTubeChannelContentApiResponseDto>({
          cls: YouTubeChannelContentApiResponseDto,
          plain: response,
        });

      this.logger.debug('YouTube channel content API 응답 검증 성공', { channelId });

      if (!channelContentResponse.items || channelContentResponse.items.length === 0) {
        this.logger.warn('YouTube channel content not found', { channelId });
        return null;
      }

      return channelContentResponse.items[0]!.contentDetails.relatedPlaylists.uploads;
    } catch (error: unknown) {
      // 유효성 검증 실패 시 상세 로그
      if (error instanceof Error && error.message.includes('validation')) {
        this.logger.error('YouTube channel content validation failed', {
          error: error.message,
          channelId,
          validationError: true,
        });
        return null; // 이 메서드는 private이므로 null 반환
      }

      this.logger.warn('Failed to get uploads playlist ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId,
      });
      return null;
    }
  }

  private async transformVideoData(video: YouTubeVideoApiData): Promise<YouTubeVideoDto> {
    try {
      // ISO 8601 duration을 초로 변환
      const duration = this.parseDuration(video.contentDetails.duration);

      const videoRawData = {
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
      };

      // 응답값 검증 및 변환
      return await transformAndValidate<YouTubeVideoDto>({
        cls: YouTubeVideoDto,
        plain: videoRawData,
      });
    } catch (error: unknown) {
      this.logger.error('YouTube video data validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId: video.id,
        validationError: true,
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

