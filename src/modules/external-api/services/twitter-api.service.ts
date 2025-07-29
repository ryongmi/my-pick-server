import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ExternalApiException } from '../exceptions';
import {
  TwitterUserDto,
  TwitterTweetDto,
  TwitterSearchResultDto,
} from '../dto';

@Injectable()
export class TwitterApiService {
  private readonly logger = new Logger(TwitterApiService.name);
  private readonly bearerToken: string;
  private readonly baseUrl = 'https://api.twitter.com/2';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bearerToken = this.configService.get<string>('TWITTER_BEARER_TOKEN');
    
    if (!this.bearerToken) {
      this.logger.error('Twitter Bearer Token not configured');
      throw new Error('Twitter Bearer Token is required');
    }

    // HTTP 서비스에 기본 헤더 설정
    this.httpService.axiosRef.defaults.headers.common['Authorization'] = 
      `Bearer ${this.bearerToken}`;
  }

  // ==================== PUBLIC METHODS ====================

  async getUserByUsername(username: string): Promise<TwitterUserDto | null> {
    try {
      this.logger.debug('Fetching Twitter user by username', { username });

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/by/username/${username}`, {
          params: {
            'user.fields': [
              'created_at',
              'description',
              'entities',
              'id',
              'location',
              'name',
              'pinned_tweet_id',
              'profile_image_url',
              'protected',
              'public_metrics',
              'url',
              'username',
              'verified',
            ].join(','),
          },
        }),
      );

      if (!response.data.data) {
        this.logger.warn('Twitter user not found', { username });
        return null;
      }

      const user = this.transformUserData(response.data.data);

      this.logger.debug('Twitter user fetched successfully', {
        username,
        userId: user.id,
        followersCount: user.publicMetrics.followersCount,
      });

      return user;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Twitter user fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        username,
      });
      throw ExternalApiException.twitterApiError();
    }
  }

  async getUserById(userId: string): Promise<TwitterUserDto | null> {
    try {
      this.logger.debug('Fetching Twitter user by ID', { userId });

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/${userId}`, {
          params: {
            'user.fields': [
              'created_at',
              'description',
              'entities',
              'id',
              'location',
              'name',
              'pinned_tweet_id',
              'profile_image_url',
              'protected',
              'public_metrics',
              'url',
              'username',
              'verified',
            ].join(','),
          },
        }),
      );

      if (!response.data.data) {
        this.logger.warn('Twitter user not found', { userId });
        return null;
      }

      const user = this.transformUserData(response.data.data);

      this.logger.debug('Twitter user fetched successfully', {
        userId,
        username: user.username,
        followersCount: user.publicMetrics.followersCount,
      });

      return user;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Twitter user fetch by ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw ExternalApiException.twitterApiError();
    }
  }

  async getUserTweets(
    userId: string,
    maxResults = 100,
    paginationToken?: string,
  ): Promise<{
    tweets: TwitterTweetDto[];
    nextToken?: string;
    resultCount: number;
  }> {
    try {
      this.logger.debug('Fetching user tweets', {
        userId,
        maxResults,
        hasPaginationToken: !!paginationToken,
      });

      const params: any = {
        max_results: Math.min(maxResults, 100), // Twitter API limit
        'tweet.fields': [
          'author_id',
          'created_at',
          'entities',
          'id',
          'in_reply_to_user_id',
          'lang',
          'public_metrics',
          'referenced_tweets',
          'reply_settings',
          'source',
          'text',
          'withheld',
        ].join(','),
        'media.fields': [
          'duration_ms',
          'height',
          'media_key',
          'preview_image_url',
          'type',
          'url',
          'width',
        ].join(','),
        expansions: [
          'attachments.media_keys',
          'referenced_tweets.id',
          'in_reply_to_user_id',
        ].join(','),
        exclude: 'retweets,replies', // 기본적으로 리트윗과 답글 제외
      };

      if (paginationToken) {
        params.pagination_token = paginationToken;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/${userId}/tweets`, {
          params,
        }),
      );

      if (!response.data.data) {
        return { tweets: [], resultCount: 0 };
      }

      const tweets = response.data.data.map((tweet: any) =>
        this.transformTweetData(tweet, response.data.includes),
      );

      this.logger.debug('User tweets fetched successfully', {
        userId,
        tweetCount: tweets.length,
        resultCount: response.data.meta.result_count,
      });

      return {
        tweets,
        nextToken: response.data.meta.next_token,
        resultCount: response.data.meta.result_count,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('User tweets fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        maxResults,
      });
      throw ExternalApiException.twitterApiError();
    }
  }

  async getTweetById(tweetId: string): Promise<TwitterTweetDto | null> {
    try {
      this.logger.debug('Fetching tweet by ID', { tweetId });

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/tweets/${tweetId}`, {
          params: {
            'tweet.fields': [
              'author_id',
              'created_at',
              'entities',
              'id',
              'in_reply_to_user_id',
              'lang',
              'public_metrics',
              'referenced_tweets',
              'reply_settings',
              'source',
              'text',
              'withheld',
            ].join(','),
            'user.fields': 'username,name,profile_image_url',
            'media.fields': [
              'duration_ms',
              'height',
              'media_key',
              'preview_image_url',
              'type',
              'url',
              'width',
            ].join(','),
            expansions: [
              'author_id',
              'attachments.media_keys',
              'referenced_tweets.id',
            ].join(','),
          },
        }),
      );

      if (!response.data.data) {
        this.logger.warn('Tweet not found', { tweetId });
        return null;
      }

      const tweet = this.transformTweetData(
        response.data.data,
        response.data.includes,
      );

      this.logger.debug('Tweet fetched successfully', {
        tweetId,
        authorId: tweet.authorId,
        retweets: tweet.publicMetrics.retweetCount,
      });

      return tweet;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Tweet fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tweetId,
      });
      throw ExternalApiException.twitterApiError();
    }
  }

  async searchTweets(
    query: string,
    maxResults = 100,
    nextToken?: string,
  ): Promise<TwitterSearchResultDto> {
    try {
      this.logger.debug('Searching tweets', {
        query,
        maxResults,
        hasNextToken: !!nextToken,
      });

      const params: any = {
        query,
        max_results: Math.min(maxResults, 100),
        'tweet.fields': [
          'author_id',
          'created_at',
          'entities',
          'id',
          'lang',
          'public_metrics',
          'referenced_tweets',
          'source',
          'text',
        ].join(','),
        'user.fields': 'username,name,profile_image_url',
        expansions: 'author_id',
      };

      if (nextToken) {
        params.next_token = nextToken;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/tweets/search/recent`, {
          params,
        }),
      );

      if (!response.data.data) {
        return {
          tweets: [],
          nextToken: undefined,
          resultCount: 0,
        };
      }

      const tweets = response.data.data.map((tweet: any) =>
        this.transformTweetData(tweet, response.data.includes),
      );

      this.logger.debug('Tweet search completed', {
        query,
        tweetCount: tweets.length,
        resultCount: response.data.meta.result_count,
      });

      return {
        tweets,
        nextToken: response.data.meta.next_token,
        resultCount: response.data.meta.result_count,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Tweet search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        maxResults,
      });
      throw ExternalApiException.twitterApiError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private transformUserData(user: any): TwitterUserDto {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      description: user.description || '',
      location: user.location,
      url: user.url,
      profileImageUrl: user.profile_image_url,
      protected: user.protected || false,
      verified: user.verified || false,
      createdAt: new Date(user.created_at),
      pinnedTweetId: user.pinned_tweet_id,
      publicMetrics: {
        followersCount: user.public_metrics.followers_count,
        followingCount: user.public_metrics.following_count,
        tweetCount: user.public_metrics.tweet_count,
        listedCount: user.public_metrics.listed_count,
      },
      entities: {
        url: user.entities?.url?.urls?.[0],
        description: user.entities?.description?.urls || [],
      },
    };
  }

  private transformTweetData(tweet: any, includes?: any): TwitterTweetDto {
    // 작성자 정보 찾기 (includes에서)
    const author = includes?.users?.find((user: any) => user.id === tweet.author_id);

    // 미디어 정보 찾기
    const mediaKeys = tweet.attachments?.media_keys || [];
    const media = includes?.media?.filter((m: any) => 
      mediaKeys.includes(m.media_key)
    ) || [];

    // 참조된 트윗 정보
    const referencedTweets = tweet.referenced_tweets?.map((ref: any) => ({
      type: ref.type,
      id: ref.id,
    })) || [];

    // 엔티티 정보 추출
    const entities = {
      urls: tweet.entities?.urls || [],
      hashtags: tweet.entities?.hashtags || [],
      mentions: tweet.entities?.mentions || [],
      cashtags: tweet.entities?.cashtags || [],
    };

    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      author: author ? {
        id: author.id,
        username: author.username,
        name: author.name,
        profileImageUrl: author.profile_image_url,
      } : undefined,
      createdAt: new Date(tweet.created_at),
      lang: tweet.lang,
      source: tweet.source,
      inReplyToUserId: tweet.in_reply_to_user_id,
      replySettings: tweet.reply_settings,
      publicMetrics: {
        retweetCount: tweet.public_metrics.retweet_count,
        likeCount: tweet.public_metrics.like_count,
        replyCount: tweet.public_metrics.reply_count,
        quoteCount: tweet.public_metrics.quote_count,
      },
      referencedTweets,
      entities,
      attachments: {
        mediaKeys,
        media: media.map((m: any) => ({
          mediaKey: m.media_key,
          type: m.type,
          url: m.url,
          previewImageUrl: m.preview_image_url,
          width: m.width,
          height: m.height,
          durationMs: m.duration_ms,
        })),
      },
      url: `https://twitter.com/${author?.username || 'i'}/status/${tweet.id}`,
    };
  }
}