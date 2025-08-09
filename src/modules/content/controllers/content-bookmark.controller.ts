import { Controller, Get, Query, UseGuards, HttpCode } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentService } from '../services/index.js';
import { ContentSearchResultDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['content-bookmark'] })
@Controller('content/bookmarks')
@UseGuards(AccessTokenGuard)
@SwaggerApiBearerAuth()
export class ContentBookmarkController {
  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '북마크된 콘텐츠 목록 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '북마크된 콘텐츠 목록 조회 성공',
    dto: ContentSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다.',
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '북마크 목록 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ContentSearchResultDto })
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
