import { Controller, Get, Query, Param, HttpCode, UseGuards } from '@nestjs/common';

import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { Serialize } from '@krgeobuk/core/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';

import { CreatorService } from '../services/creator.service.js';
import { CreatorSearchQueryDto, CreatorSearchResultDto } from '../dto/index.js';
import { CreatorEntity } from '../entities/creator.entity.js';

@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('creators')
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  /**
   * 크리에이터 검색
   * GET /creators?page=1&limit=30&keyword=ado&activeOnly=true
   */
  @Get()
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 목록 조회 성공',
  })
  async searchCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query);
  }

  /**
   * 크리에이터 상세 조회
   * GET /creators/:id
   */
  @Get(':id')
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 상세 조회 성공',
  })
  async getCreatorDetail(@Param('id') id: string): Promise<CreatorEntity> {
    return await this.creatorService.findByIdOrFail(id);
  }
}
