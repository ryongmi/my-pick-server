import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';

import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentService } from '../services/index.js';
import { ContentSearchResultDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['user-content-interaction'] })
@Controller('users/:userId/interactions')
export class UserContentInteractionController {
  constructor(
    private readonly userInteractionService: UserInteractionService,
    private readonly contentService: ContentService
  ) {}

  @Get('content')
  @SwaggerApiOperation({ summary: '사용자가 상호작용한 콘텐츠 목록 조회' })
  @SwaggerApiParam({
    name: 'userId',
    description: '사용자 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '상호작용한 콘텐츠 목록 조회 성공',
    dto: ContentSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '사용자를 찾을 수 없습니다.',
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getUserInteractedContent(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<ContentSearchResultDto[]> {
    const interactions = await this.userInteractionService.getInteractionsByUserId(userId);
    const contentIds = interactions.map((interaction) => interaction.contentId);

    if (contentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(contentIds);

    return contents.map((content) => {
      const interaction = interactions.find((i) => i.contentId === content.id);
      return plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          isBookmarked: interaction?.isBookmarked,
          isLiked: interaction?.isLiked,
          watchedAt: interaction?.watchedAt,
          rating: interaction?.rating,
        },
        {
          excludeExtraneousValues: true,
        }
      );
    });
  }

  @Get('bookmarks')
  @SwaggerApiOperation({ summary: '사용자 북마크 콘텐츠 ID 목록 조회' })
  @SwaggerApiParam({
    name: 'userId',
    description: '사용자 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '북마크 콘텐츠 ID 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        contentIds: {
          type: 'array',
          items: { type: 'string' },
          description: '북마크한 콘텐츠 ID 목록',
        },
      },
    },
  })
  async getUserBookmarks(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getBookmarkedContentIds(userId);
    return { contentIds };
  }

  @Get('likes')
  @SwaggerApiOperation({ summary: '사용자 좋아요 콘텐츠 ID 목록 조회' })
  @SwaggerApiParam({
    name: 'userId',
    description: '사용자 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '좋아요 콘텐츠 ID 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        contentIds: {
          type: 'array',
          items: { type: 'string' },
          description: '좋아요한 콘텐츠 ID 목록',
        },
      },
    },
  })
  async getUserLikes(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getLikedContentIds(userId);
    return { contentIds };
  }

  @Get('watch-history')
  @SwaggerApiOperation({ summary: '사용자 시청 기록 조회' })
  @SwaggerApiParam({
    name: 'userId',
    description: '사용자 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '시청 기록 조회 성공',
    dto: ContentSearchResultDto,
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getWatchHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit: number = 50
  ): Promise<ContentSearchResultDto[]> {
    const interactions = await this.userInteractionService.getWatchHistory(userId, limit);
    const contentIds = interactions.map((interaction) => interaction.contentId);

    if (contentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(contentIds);

    return contents.map((content) => {
      const interaction = interactions.find((i) => i.contentId === content.id);
      return plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          watchedAt: interaction?.watchedAt,
          watchDuration: interaction?.watchDuration,
          rating: interaction?.rating,
        },
        {
          excludeExtraneousValues: true,
        }
      );
    });
  }

  @Get('stats')
  @SwaggerApiOperation({ summary: '사용자 상호작용 통계 조회' })
  @SwaggerApiParam({
    name: 'userId',
    description: '사용자 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '상호작용 통계 조회 성공',
    schema: {
      type: 'object',
      properties: {
        totalInteractions: {
          type: 'number',
          description: '총 상호작용 수',
          example: 150,
        },
        bookmarkCount: {
          type: 'number',
          description: '북마크 수',
          example: 25,
        },
        likeCount: {
          type: 'number',
          description: '좋아요 수',
          example: 80,
        },
      },
    },
  })
  async getUserInteractionStats(@Param('userId', ParseUUIDPipe) userId: string): Promise<{
    totalInteractions: number;
    bookmarkCount: number;
    likeCount: number;
  }> {
    const [totalInteractions, bookmarkCount, likeCount] = await Promise.all([
      this.userInteractionService.getUserInteractionCount(userId),
      this.userInteractionService.getUserBookmarkCount(userId),
      this.userInteractionService.getUserLikeCount(userId),
    ]);

    return {
      totalInteractions,
      bookmarkCount,
      likeCount,
    };
  }
}