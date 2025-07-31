import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import {
  UserInteractionService,
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
} from '@modules/user-interaction/index.js';

import { ContentService } from '../services/index.js';
import { ContentSearchQueryDto, ContentSearchResultDto, ContentDetailDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['content'] })
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '콘텐츠 목록 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 목록 조회 성공',
    dto: ContentSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '콘텐츠 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getContent(
    @Query() query: ContentSearchQueryDto,
    @CurrentJwt() jwt?: JwtPayload
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    const userId = jwt?.id; // 선택적 인증: 로그인하지 않은 사용자도 볼 수 있음
    return this.contentService.searchContent(query, userId);
  }

  @Get('trending')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '트렌딩 콘텐츠 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '트렌딩 콘텐츠 조회 성공',
    dto: ContentSearchResultDto,
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getTrendingContent(
    @Query('hours') hours: number = 24,
    @Query('limit') limit: number = 50
  ): Promise<ContentSearchResultDto[]> {
    return this.contentService.getTrendingContent(hours, limit);
  }

  @Get('recent')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '최신 콘텐츠 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '최신 콘텐츠 조회 성공',
    dto: ContentSearchResultDto,
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getRecentContent(
    @Query('creatorIds') creatorIds: string,
    @Query('limit') limit: number = 20
  ): Promise<ContentSearchResultDto[]> {
    const creatorIdArray = creatorIds ? creatorIds.split(',') : [];
    return this.contentService.getRecentContent(creatorIdArray, limit);
  }

  @Get(':id')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '콘텐츠 상세 조회' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 상세 조회 성공',
    dto: ContentDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  @Serialize({ dto: ContentDetailDto })
  async getContentById(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() jwt?: JwtPayload
  ): Promise<ContentDetailDto> {
    const userId = jwt?.id; // 선택적 인증: 로그인하지 않은 사용자도 볼 수 있음
    return this.contentService.getContentById(contentId, userId);
  }

  @Post(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '콘텐츠 북마크 추가' })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 북마크가 성공적으로 추가되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  async bookmarkContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {

    await this.contentService.findByIdOrFail(contentId);

    const dto: BookmarkContentDto = {
      userId: id,
      contentId,
    };

    await this.userInteractionService.bookmarkContent(dto);
  }

  @Delete(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async removeBookmark(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    await this.userInteractionService.removeBookmark(id, contentId);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async likeContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: LikeContentDto = {
      userId: id,
      contentId,
    };

    await this.userInteractionService.likeContent(dto);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async removeLike(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    await this.userInteractionService.removeLike(id, contentId);
  }

  @Post(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async watchContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { watchDuration?: number } = {},
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: WatchContentDto = {
      userId: id,
      contentId,
      watchDuration: body.watchDuration,
    };

    await this.userInteractionService.watchContent(dto);
  }

  @Post(':id/rate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async rateContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { rating: number },
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {

    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    const dto: RateContentDto = {
      userId: id,
      contentId,
      rating: body.rating,
    };

    await this.userInteractionService.rateContent(dto);
  }

  // ==================== 실시간 토글 API ====================

  @Post(':id/bookmark/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '콘텐츠 북마크 토글 (실시간)' })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '북마크 토글 성공',
  })
  async toggleBookmark(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<{ isBookmarked: boolean }> {
    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    return this.userInteractionService.toggleBookmark(id, contentId);
  }

  @Post(':id/like/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '콘텐츠 좋아요 토글 (실시간)' })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '좋아요 토글 성공',
  })
  async toggleLike(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<{ isLiked: boolean }> {
    // 콘텐츠 존재 확인
    await this.contentService.findByIdOrFail(contentId);

    return this.userInteractionService.toggleLike(id, contentId);
  }
}

// 북마크 관리 컨트롤러
@Controller('content/bookmarks')
@UseGuards(AccessTokenGuard)
@SwaggerApiBearerAuth()
export class ContentBookmarkController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  @Get()
  async getBookmarkedContent(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<ContentSearchResultDto[]> {

    const bookmarkedContentIds = await this.userInteractionService.getBookmarkedContentIds(id);

    if (bookmarkedContentIds.length === 0) {
      return [];
    }

    const contents = await this.contentService.findByIds(bookmarkedContentIds);

    return contents.map((content) =>
      plainToInstance(
        ContentSearchResultDto,
        {
          ...content,
          isBookmarked: true,
        },
        {
          excludeExtraneousValues: true,
        }
      )
    );
  }
}

// 사용자별 상호작용 관리
@Controller('users/:userId/interactions')
export class UserContentInteractionController {
  constructor(
    private readonly userInteractionService: UserInteractionService,
    private readonly contentService: ContentService
  ) {}

  @Get('content')
  // @UseGuards(AuthGuard)
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
  // @UseGuards(AuthGuard)
  async getUserBookmarks(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getBookmarkedContentIds(userId);
    return { contentIds };
  }

  @Get('likes')
  // @UseGuards(AuthGuard)
  async getUserLikes(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.userInteractionService.getLikedContentIds(userId);
    return { contentIds };
  }

  @Get('watch-history')
  // @UseGuards(AuthGuard)
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
  // @UseGuards(AuthGuard)
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

