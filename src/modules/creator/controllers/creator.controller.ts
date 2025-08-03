import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
  SwaggerApiBody,
} from '@krgeobuk/swagger/decorators';

import { CreatorService } from '../services/creator.service.js';
import { CreatorPlatformService } from '../services/creator-platform.service.js';
import { CreatorConsentService } from '../services/creator-consent.service.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
  CreatePlatformDto,
  UpdatePlatformDto,
  GrantConsentDto,
} from '../dto/index.js';
import { ConsentType } from '../entities/creator-consent.entity.js';

@SwaggerApiTags({ tags: ['creators'] })
@Controller('creators')
export class CreatorController {
  constructor(
    private readonly creatorService: CreatorService,
    private readonly platformService: CreatorPlatformService,
    private readonly consentService: CreatorConsentService
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

  @Post()
  @SwaggerApiOperation({
    summary: '크리에이터 생성',
    description: '새로운 크리에이터를 생성합니다.',
  })
  @SwaggerApiBody({ dto: CreateCreatorDto, description: '크리에이터 생성 데이터' })
  @SwaggerApiOkResponse({
    status: 201,
    description: '크리에이터가 성공적으로 생성됨',
  })
  @SwaggerApiErrorResponse({
    status: 409,
    description: '이미 존재하는 크리에이터입니다.',
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '크리에이터 생성 중 오류가 발생했습니다.',
  })
  @HttpCode(HttpStatus.CREATED)
  async createCreator(
    @Body() createCreatorDto: CreateCreatorDto
  ): Promise<{ success: boolean; id: string }> {
    const creator = await this.creatorService.createCreator(createCreatorDto);

    return {
      success: true,
      id: creator.id,
    };
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

  @Patch(':id')
  @SwaggerApiOperation({
    summary: '크리에이터 정보 수정',
    description: '크리에이터의 정보를 수정합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiBody({ dto: UpdateCreatorDto, description: '크리에이터 수정 데이터' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 정보가 성공적으로 수정됨',
  })
  async updateCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() updateCreatorDto: UpdateCreatorDto
  ): Promise<{ success: boolean }> {
    await this.creatorService.updateCreator(creatorId, updateCreatorDto);

    return { success: true };
  }

  @Delete(':id')
  @SwaggerApiOperation({
    summary: '크리에이터 삭제',
    description: '크리에이터를 삭제합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터가 성공적으로 삭제됨',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '크리에이터 삭제 중 오류가 발생했습니다.',
  })
  async deleteCreator(
    @Param('id', ParseUUIDPipe) creatorId: string
  ): Promise<{ success: boolean }> {
    await this.creatorService.deleteCreator(creatorId);

    return { success: true };
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

  @Post(':id/platforms')
  @SwaggerApiOperation({
    summary: '크리에이터 플랫폼 추가',
    description: '크리에이터에 새로운 플랫폼을 연결합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiBody({ dto: CreatePlatformDto, description: '플랫폼 생성 데이터' })
  @SwaggerApiOkResponse({
    status: 201,
    description: '플랫폼이 성공적으로 추가됨',
  })
  @HttpCode(HttpStatus.CREATED)
  async addPlatform(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() createPlatformDto: CreatePlatformDto
  ): Promise<{ success: boolean; id: string }> {
    const platform = await this.platformService.createPlatform({
      creatorId,
      ...createPlatformDto,
    });

    return {
      success: true,
      id: platform.id,
    };
  }

  @Patch(':id/platforms/:platformId')
  @SwaggerApiOperation({
    summary: '플랫폼 정보 수정',
    description: '크리에이터의 플랫폼 정보를 수정합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiParam({
    name: 'platformId',
    type: String,
    description: '플랫폼 ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @SwaggerApiBody({ dto: UpdatePlatformDto, description: '플랫폼 수정 데이터' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 정보가 성공적으로 수정됨',
  })
  async updatePlatform(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @Body() updatePlatformDto: UpdatePlatformDto
  ): Promise<{ success: boolean }> {
    await this.platformService.updatePlatform(platformId, updatePlatformDto);

    return { success: true };
  }

  @Delete(':id/platforms/:platformId')
  @SwaggerApiOperation({
    summary: '플랫폼 연결 해제',
    description: '크리에이터의 플랫폼 연결을 해제합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiParam({
    name: 'platformId',
    type: String,
    description: '플랫폼 ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 연결이 성공적으로 해제됨',
  })
  async removePlatform(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('platformId', ParseUUIDPipe) platformId: string
  ): Promise<{ success: boolean }> {
    await this.platformService.deactivatePlatform(platformId);

    return { success: true };
  }

  // ==================== 동의 관리 ====================

  @Get(':id/consents')
  @SwaggerApiOperation({
    summary: '크리에이터 동의 목록 조회',
    description: '크리에이터의 현재 유효한 동의 목록을 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '동의 목록',
  })
  async getCreatorConsents(@Param('id', ParseUUIDPipe) creatorId: string) {
    const activeConsents = await this.consentService.getActiveConsents(creatorId);

    return {
      creatorId,
      activeConsents,
      totalCount: activeConsents.length,
    };
  }

  @Get(':id/consents/:type')
  @SwaggerApiOperation({
    summary: '특정 동의 타입 상태 확인',
    description: '크리에이터의 특정 동의 타입 상태를 확인합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiParam({
    name: 'type',
    type: String,
    description: '동의 타입',
    example: ConsentType.DATA_COLLECTION,
    enum: ConsentType,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '동의 상태',
  })
  async checkConsent(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: ConsentType
  ) {
    const hasConsent = await this.consentService.hasConsent(creatorId, type);

    return {
      creatorId,
      type,
      hasConsent,
    };
  }

  @Post(':id/consents')
  @SwaggerApiOperation({
    summary: '동의 생성',
    description: '크리에이터의 새로운 동의를 생성합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiBody({ dto: GrantConsentDto, description: '동의 생성 데이터' })
  @SwaggerApiOkResponse({
    status: 201,
    description: '동의가 성공적으로 생성됨',
  })
  @HttpCode(HttpStatus.CREATED)
  async grantConsent(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() grantConsentDto: GrantConsentDto
  ): Promise<{ success: boolean }> {
    await this.consentService.grantConsent({
      creatorId,
      ...grantConsentDto,
    });

    return { success: true };
  }

  @Delete(':id/consents/:type')
  @SwaggerApiOperation({
    summary: '동의 철회',
    description: '크리에이터의 특정 동의를 철회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiParam({
    name: 'type',
    type: String,
    description: '동의 타입',
    example: ConsentType.DATA_COLLECTION,
    enum: ConsentType,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '동의가 성공적으로 철회됨',
    dto: { success: boolean },
  })
  async revokeConsent(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: ConsentType
  ): Promise<{ success: boolean }> {
    await this.consentService.revokeConsent(creatorId, type);

    return { success: true };
  }

  @Get(':id/consents/:type/history')
  @SwaggerApiOperation({
    summary: '동의 이력 조회',
    description: '크리에이터의 특정 동의 타입 이력을 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiParam({
    name: 'type',
    type: String,
    description: '동의 타입',
    example: ConsentType.DATA_COLLECTION,
    enum: ConsentType,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '동의 이력',
  })
  async getConsentHistory(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: ConsentType
  ) {
    const history = await this.consentService.getConsentHistory(creatorId, type);

    return {
      creatorId,
      type,
      history,
      totalCount: history.length,
    };
  }
}
