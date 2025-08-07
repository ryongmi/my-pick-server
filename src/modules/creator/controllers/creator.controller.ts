import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import { PaginatedResult } from '@krgeobuk/core/interfaces';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';

import { CreatorService } from '../services/creator.service.js';
import { CreatorPlatformService } from '../services/creator-platform.service.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreatorStatsDto,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['creators'] })
@Controller('creators')
export class CreatorController {
  constructor(
    private readonly creatorService: CreatorService,
    private readonly platformService: CreatorPlatformService
  ) {}

  // ==================== 크리에이터 기본 CRUD ====================

  @Get()
  @SwaggerApiOperation({
    summary: '크리에이터 검색',
    description: '이름, 카테고리, 태그 등으로 크리에이터를 검색합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '검색 결과',
    dto: CreatorSearchResultDto,
  })
  @Serialize({ dto: CreatorSearchResultDto })
  async searchCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query);
  }


  @Get(':id')
  @SwaggerApiOperation({
    summary: '크리에이터 상세 조회',
    description: '특정 크리에이터의 상세 정보를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 상세 정보',
    dto: CreatorDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '크리에이터 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: CreatorDetailDto })
  async getCreator(@Param('id', ParseUUIDPipe) creatorId: string): Promise<CreatorDetailDto> {
    return await this.creatorService.getCreatorById(creatorId);
  }



  // ==================== 플랫폼 관리 ====================

  @Get(':id/platforms')
  @SwaggerApiOperation({
    summary: '크리에이터 플랫폼 목록 조회',
    description: '크리에이터의 연결된 플랫폼 목록을 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 목록',
  })
  async getCreatorPlatforms(@Param('id', ParseUUIDPipe) creatorId: string) {
    return await this.platformService.findByCreatorId(creatorId);
  }






  // ==================== 향상된 통계 ====================

  @Get(':id/stats')
  @SwaggerApiOperation({
    summary: '크리에이터 통계 조회',
    description: '크리에이터의 상세 통계 정보를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 통계',
    dto: CreatorStatsDto,
  })
  @Serialize({ dto: CreatorStatsDto })
  async getCreatorStats(@Param('id', ParseUUIDPipe) creatorId: string): Promise<CreatorStatsDto> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    // 크리에이터 상세 정보 조회 (플랫폼 통계 포함)
    const creatorDetail = await this.creatorService.getCreatorById(creatorId);

    return {
      subscriberCount: 0, // TODO: 구독자 수는 User-Subscription 도메인에서 별도 API로 제공
      followerCount: creatorDetail.platformStats.totalFollowers,
      contentCount: creatorDetail.platformStats.totalContent,
      totalViews: creatorDetail.platformStats.totalViews,
    };
  }

}
