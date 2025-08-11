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
  HttpException,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
// import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
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

import {
  ContentService,
  ContentOrchestrationService,
  ContentCategoryService,
  ContentTagService,
  ContentInteractionService,
} from '../services/index.js';
import { ContentSearchQueryDto, ContentSearchResultDto, TrendingContentDto, ContentDetailDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['content'] })
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly contentOrchestrationService: ContentOrchestrationService,
    private readonly userInteractionService: UserInteractionService,
    private readonly contentCategoryService: ContentCategoryService,
    private readonly contentTagService: ContentTagService,
    private readonly contentInteractionService: ContentInteractionService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '콘텐츠 목록 조회' })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '콘텐츠 목록 조회 성공',
    dto: ContentSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: '콘텐츠 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getContent(
    @Query() query: ContentSearchQueryDto,
    @CurrentJwt() jwt?: JwtPayload
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    try {
      const userId = jwt?.id; // 선택적 인증: 로그인하지 않은 사용자도 볼 수 있음
      return await this.contentOrchestrationService.searchContent(query, userId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '콘텐츠 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('trending')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '트렌딩 콘텐츠 조회' })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '트렌딩 콘텐츠 조회 성공',
    dto: TrendingContentDto,
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: '트렌딩 콘텐츠 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: TrendingContentDto })
  async getTrendingContent(
    @Query('hours') hours: number = 24,
    @Query('limit') limit: number = 50
  ): Promise<TrendingContentDto[]> {
    try {
      return await this.contentOrchestrationService.getTrendingContent(hours, limit);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '트렌딩 콘텐츠 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('recent')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '최신 콘텐츠 조회' })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '최신 콘텐츠 조회 성공',
    dto: ContentSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 크리에이터 ID 형식입니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: '최신 콘텐츠 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ContentSearchResultDto })
  async getRecentContent(
    @Query('creatorIds') creatorIds: string,
    @Query('limit') limit: number = 20
  ): Promise<ContentSearchResultDto[]> {
    try {
      const creatorIdArray = creatorIds ? creatorIds.split(',').filter(id => id.trim()) : [];
      return await this.contentOrchestrationService.getRecentContent(creatorIdArray, limit);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '최신 콘텐츠 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '콘텐츠 상세 조회' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '콘텐츠 상세 조회 성공',
    dto: ContentDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 콘텐츠 ID 형식입니다.',
  })
  @Serialize({ dto: ContentDetailDto })
  async getContentById(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() jwt?: JwtPayload
  ): Promise<ContentDetailDto> {
    try {
      const userId = jwt?.id; // 선택적 인증: 로그인하지 않은 사용자도 볼 수 있음
      return await this.contentService.getContentById(contentId, userId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '콘텐츠 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    try {
      await this.contentService.findByIdOrFail(contentId);

      const dto: BookmarkContentDto = {
        userId: id,
        contentId,
      };

      await this.userInteractionService.bookmarkContent(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '북마크 추가 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async removeBookmark(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      await this.userInteractionService.removeBookmark(id, contentId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '북마크 제거 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async likeContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      const dto: LikeContentDto = {
        userId: id,
        contentId,
      };

      await this.userInteractionService.likeContent(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '좋아요 추가 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async removeLike(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      await this.userInteractionService.removeLike(id, contentId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '좋아요 제거 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  async watchContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { watchDuration?: number; watchPercentage?: number } = {},
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      // 입력값 검증
      if (body.watchDuration !== undefined && body.watchDuration < 0) {
        throw new HttpException(
          '시청 시간은 0 이상이어야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      if (body.watchPercentage !== undefined && (body.watchPercentage < 0 || body.watchPercentage > 100)) {
        throw new HttpException(
          '시청 비율은 0-100% 범위여야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      const dto: WatchContentDto = {
        userId: id,
        contentId,
        watchDuration: body.watchDuration,
      };

      await this.userInteractionService.watchContent(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '시청 기록 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    try {
      // 입력값 검증
      if (body.rating < 1 || body.rating > 5) {
        throw new HttpException(
          '평점은 1-5 범위여야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      const dto: RateContentDto = {
        userId: id,
        contentId,
        rating: body.rating,
      };

      await this.userInteractionService.rateContent(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '평점 등록 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      return await this.userInteractionService.toggleBookmark(id, contentId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '북마크 토글 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      return await this.userInteractionService.toggleLike(id, contentId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '좋아요 토글 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== 카테고리 관련 엔드포인트 ====================

  @Get(':id/categories')
  @SwaggerApiOperation({ summary: '콘텐츠 카테고리 조회' })
  @SwaggerApiParam({ name: 'id', description: '콘텐츠 ID', type: String })
  @SwaggerApiOkResponse({ description: '콘텐츠 카테고리 목록', status: HttpStatus.OK })
  @SwaggerApiErrorResponse({ 
    status: HttpStatus.NOT_FOUND,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  async getContentCategories(
    @Param('id', ParseUUIDPipe) contentId: string
  ): Promise<Array<{ category: string; isPrimary: boolean; confidence: number }>> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);
      
      const categories = await this.contentCategoryService.findByContentId(contentId);
      return categories.map((cat) => ({
        category: cat.category,
        isPrimary: cat.isPrimary,
        confidence: cat.confidence,
      }));
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '콘텐츠 카테고리 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/tags')
  @SwaggerApiOperation({ summary: '콘텐츠 태그 조회' })
  @SwaggerApiParam({ name: 'id', description: '콘텐츠 ID', type: String })
  @SwaggerApiOkResponse({ description: '콘텐츠 태그 목록', status: HttpStatus.OK })
  @SwaggerApiErrorResponse({ 
    status: HttpStatus.NOT_FOUND,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  async getContentTags(
    @Param('id', ParseUUIDPipe) contentId: string
  ): Promise<Array<{ tag: string; source: string; relevanceScore: number }>> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);
      
      const tags = await this.contentTagService.findByContentId(contentId);
      return tags.map((tag) => ({
        tag: tag.tag,
        source: tag.source,
        relevanceScore: tag.relevanceScore,
      }));
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '콘텐츠 태그 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/performance')
  @SwaggerApiOperation({ summary: '콘텐츠 성과 조회' })
  @SwaggerApiParam({ name: 'id', description: '콘텐츠 ID', type: String })
  @SwaggerApiOkResponse({ description: '콘텐츠 성과 정보', status: HttpStatus.OK })
  @SwaggerApiErrorResponse({ 
    status: HttpStatus.NOT_FOUND,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
  async getContentPerformance(@Param('id', ParseUUIDPipe) contentId: string): Promise<{
    viewCount: number;
    likeCount: number;
    bookmarkCount: number;
    shareCount: number;
    commentCount: number;
    avgWatchPercentage: number;
    avgRating: number;
  } | null> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);
      
      return await this.contentInteractionService.getContentPerformance(contentId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '콘텐츠 성과 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== 새로운 상호작용 메서드 (ContentInteractionService 활용) ====================

  @Post(':id/interaction/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '콘텐츠 시청 기록' })
  async recordView(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body()
    body: {
      watchDuration?: number;
      watchPercentage?: number;
      deviceType?: string;
      referrer?: string;
    },
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      // 입력값 검증
      if (body.watchDuration !== undefined && body.watchDuration < 0) {
        throw new HttpException(
          '시청 시간은 0 이상이어야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      if (body.watchPercentage !== undefined && (body.watchPercentage < 0 || body.watchPercentage > 100)) {
        throw new HttpException(
          '시청 비율은 0-100% 범위여야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.contentService.findByIdOrFail(contentId);
      await this.contentInteractionService.recordView(contentId, id, body);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '시청 기록 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/interaction/bookmark/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '북마크 토글 (새 구현)' })
  async toggleBookmarkNew(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<{ isBookmarked: boolean }> {
    try {
      await this.contentService.findByIdOrFail(contentId);
      return await this.contentInteractionService.toggleBookmark(contentId, id);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '북마크 토글 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/interaction/like/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '좋아요 토글 (새 구현)' })
  async toggleLikeNew(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<{ isLiked: boolean }> {
    try {
      await this.contentService.findByIdOrFail(contentId);
      return await this.contentInteractionService.toggleLike(contentId, id);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '좋아요 토글 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/interaction/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '콘텐츠 공유 기록' })
  async markAsShared(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      await this.contentService.findByIdOrFail(contentId);
      await this.contentInteractionService.markAsShared(contentId, id);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '공유 기록 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/interaction/rating')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiBearerAuth()
  @SwaggerApiOperation({ summary: '콘텐츠 평점 제출' })
  async submitRating(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() body: { rating: number; comment?: string },
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    try {
      // 입력값 검증
      if (body.rating < 1 || body.rating > 5) {
        throw new HttpException(
          '평점은 1-5 범위여야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

      if (body.comment && body.comment.length > 500) {
        throw new HttpException(
          '코멘트는 500자 이하로 작성해 주세요.',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.contentService.findByIdOrFail(contentId);
      await this.contentInteractionService.submitRating(contentId, id, body.rating, body.comment);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '평점 등록 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '북마크한 콘텐츠 목록 조회' })
  @SwaggerApiOkResponse({ 
    description: '북마크한 콘텐츠 목록',
    status: HttpStatus.OK,
  })
  async getBookmarkedContent(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<ContentSearchResultDto[]> {
    try {
      // 입력값 검증
      if (page < 1) {
        throw new HttpException(
          '페이지는 1 이상이어야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }
      
      if (limit < 1 || limit > 100) {
        throw new HttpException(
          '제한 수는 1-100 범위여야 합니다.',
          HttpStatus.BAD_REQUEST
        );
      }

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
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '북마크 목록 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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

// ==================== 새로운 컨트롤러들 ====================

// 카테고리 관리 컨트롤러
@SwaggerApiTags({ tags: ['content-categories'] })
@Controller('content/categories')
export class ContentCategoryController {
  constructor(private readonly contentCategoryService: ContentCategoryService) {}

  @Get('popular')
  @SwaggerApiOperation({ summary: '인기 카테고리 조회' })
  @SwaggerApiOkResponse({ description: '인기 카테고리 목록', status: 200 })
  async getPopularCategories(
    @Query('limit') limit = 10
  ): Promise<Array<{ category: string; contentCount: number }>> {
    return await this.contentCategoryService.getTopCategories(limit);
  }

  @Get('distribution')
  @SwaggerApiOperation({ summary: '카테고리 분포 조회' })
  @SwaggerApiOkResponse({ description: '카테고리 분포 정보', status: 200 })
  async getCategoryDistribution(): Promise<
    Array<{ category: string; count: number; percentage: number }>
  > {
    return await this.contentCategoryService.getCategoryDistribution();
  }

  @Get(':category/content')
  @SwaggerApiOperation({ summary: '특정 카테고리의 콘텐츠 조회' })
  @SwaggerApiParam({ name: 'category', description: '카테고리명', type: String })
  @SwaggerApiOkResponse({ description: '카테고리별 콘텐츠 ID 목록', status: 200 })
  async getContentsByCategory(
    @Param('category') category: string,
    @Query('limit') limit = 50
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.contentCategoryService.getContentsByCategory(category, limit);
    return { contentIds };
  }
}

// 태그 관리 컨트롤러
@SwaggerApiTags({ tags: ['content-tags'] })
@Controller('content/tags')
export class ContentTagController {
  constructor(private readonly contentTagService: ContentTagService) {}

  @Get('popular')
  @SwaggerApiOperation({ summary: '인기 태그 조회' })
  @SwaggerApiOkResponse({ description: '인기 태그 목록', status: 200 })
  async getPopularTags(
    @Query('limit') limit = 50
  ): Promise<Array<{ tag: string; usageCount: number; recentUsage: number }>> {
    return await this.contentTagService.getPopularTags(limit);
  }

  @Get('trending')
  @SwaggerApiOperation({ summary: '트렌딩 태그 조회' })
  @SwaggerApiOkResponse({ description: '트렌딩 태그 목록', status: 200 })
  async getTrendingTags(
    @Query('days') days = 7,
    @Query('limit') limit = 20
  ): Promise<Array<{ tag: string; recentCount: number }>> {
    return await this.contentTagService.getTrendingTags(days, limit);
  }

  @Get('search')
  @SwaggerApiOperation({ summary: '태그 검색' })
  @SwaggerApiOkResponse({ description: '검색된 태그 목록', status: 200 })
  async searchTags(
    @Query('q') query: string,
    @Query('limit') limit = 20
  ): Promise<{ tags: string[] }> {
    const tags = await this.contentTagService.searchTags(query, limit);
    return { tags };
  }

  @Get('suggestions')
  @SwaggerApiOperation({ summary: '태그 제안' })
  @SwaggerApiOkResponse({ description: '제안된 태그 목록', status: 200 })
  async getTagSuggestions(
    @Query('partial') partialTag: string,
    @Query('limit') limit = 10
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.contentTagService.getTagSuggestions(partialTag, limit);
    return { suggestions };
  }

  @Get(':tag/similar')
  @SwaggerApiOperation({ summary: '유사 태그 조회' })
  @SwaggerApiParam({ name: 'tag', description: '기준 태그', type: String })
  @SwaggerApiOkResponse({ description: '유사 태그 목록', status: 200 })
  async getSimilarTags(
    @Param('tag') tag: string,
    @Query('limit') limit = 10
  ): Promise<{ similarTags: string[] }> {
    const similarTags = await this.contentTagService.getSimilarTags(tag, limit);
    return { similarTags };
  }

  @Get(':tag/content')
  @SwaggerApiOperation({ summary: '특정 태그의 콘텐츠 조회' })
  @SwaggerApiParam({ name: 'tag', description: '태그명', type: String })
  @SwaggerApiOkResponse({ description: '태그별 콘텐츠 ID 목록', status: 200 })
  async getContentsByTag(
    @Param('tag') tag: string,
    @Query('limit') limit = 50
  ): Promise<{ contentIds: string[] }> {
    const contentIds = await this.contentTagService.getContentsByTag(tag, limit);
    return { contentIds };
  }
}

// 콘텐츠 성과 분석 컨트롤러
@SwaggerApiTags({ tags: ['content-analytics'] })
@Controller('content/analytics')
export class ContentAnalyticsController {
  constructor(private readonly contentInteractionService: ContentInteractionService) {}

  @Get('top-performing')
  @SwaggerApiOperation({ summary: '최고 성과 콘텐츠 조회' })
  @SwaggerApiOkResponse({ description: '최고 성과 콘텐츠 목록', status: 200 })
  async getTopPerformingContent(@Query('limit') limit = 20): Promise<
    Array<{
      contentId: string;
      viewCount: number;
      likeCount: number;
      bookmarkCount: number;
      shareCount: number;
      avgWatchPercentage: number;
      avgRating: number;
    }>
  > {
    return await this.contentInteractionService.getTopPerformingContent(limit);
  }

  @Get('engagement/users')
  @SwaggerApiOperation({ summary: '가장 활발한 사용자 조회' })
  @SwaggerApiOkResponse({ description: '활발한 사용자 목록', status: 200 })
  async getMostEngagedUsers(@Query('limit') limit = 50): Promise<
    Array<{
      userId: string;
      interactionCount: number;
      avgWatchPercentage: number;
      lastInteractionAt: Date;
    }>
  > {
    return await this.contentInteractionService.getMostEngagedUsers(limit);
  }

  @Get('stats/overall')
  @SwaggerApiOperation({ summary: '전체 상호작용 통계 조회' })
  @SwaggerApiOkResponse({ description: '전체 통계 정보', status: 200 })
  async getOverallStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<{
    totalInteractions: number;
    uniqueUsers: number;
    avgWatchPercentage: number;
    avgRating: number;
  }> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return await this.contentInteractionService.getOverallStats(start, end);
  }

  @Get('device-usage')
  @SwaggerApiOperation({ summary: '디바이스별 사용 통계 조회' })
  @SwaggerApiOkResponse({ description: '디바이스별 통계', status: 200 })
  async getDeviceUsageStats(
    @Query('contentId') contentId?: string
  ): Promise<Array<{ deviceType: string; count: number }>> {
    return await this.contentInteractionService.getInteractionsByDevice(contentId);
  }
}
