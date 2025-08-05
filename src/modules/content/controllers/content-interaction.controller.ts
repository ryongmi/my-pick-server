import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

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
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import {
  UserInteractionService,
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
} from '@modules/user-interaction/index.js';

import { ContentService } from '../services/index.js';

@SwaggerApiTags({ tags: ['content-interaction'] })
@Controller('content')
@UseGuards(AccessTokenGuard)
@SwaggerApiBearerAuth()
export class ContentInteractionController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  // ==================== 북마크 관리 ====================

  @Post(':id/bookmark')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '콘텐츠 북마크 추가' })
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
  @SwaggerApiOperation({ summary: '콘텐츠 북마크 제거' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 북마크가 성공적으로 제거되었습니다.',
  })
  async removeBookmark(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    await this.userInteractionService.removeBookmark(id, contentId);
  }

  @Post(':id/bookmark/toggle')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '콘텐츠 북마크 토글 (실시간)' })
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

  // ==================== 좋아요 관리 ====================

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '콘텐츠 좋아요 추가' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 좋아요가 성공적으로 추가되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
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
  @SwaggerApiOperation({ summary: '콘텐츠 좋아요 제거' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 좋아요가 성공적으로 제거되었습니다.',
  })
  async removeLike(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    await this.userInteractionService.removeLike(id, contentId);
  }

  @Post(':id/like/toggle')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({ summary: '콘텐츠 좋아요 토글 (실시간)' })
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

  // ==================== 시청 기록 ====================

  @Post(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '콘텐츠 시청 기록' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiBody({
    description: '시청 정보',
    schema: {
      type: 'object',
      properties: {
        watchDuration: {
          type: 'number',
          description: '시청 시간 (초)',
          example: 120,
        },
      },
    },
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 시청 기록이 성공적으로 저장되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
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

  // ==================== 평점 관리 ====================

  @Post(':id/rate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '콘텐츠 평점 등록' })
  @SwaggerApiParam({
    name: 'id',
    description: '콘텐츠 ID',
    type: String,
  })
  @SwaggerApiBody({
    description: '평점 정보',
    schema: {
      type: 'object',
      properties: {
        rating: {
          type: 'number',
          description: '평점 (1-5)',
          minimum: 1,
          maximum: 5,
          example: 4.5,
        },
      },
      required: ['rating'],
    },
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '콘텐츠 평점이 성공적으로 등록되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다.',
  })
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
}