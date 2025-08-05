import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentService } from '../services/index.js';
import { ContentSearchQueryDto, ContentSearchResultDto, ContentDetailDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['content'] })
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

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

}

