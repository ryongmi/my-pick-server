import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In, UpdateResult, Not } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CacheService } from '@database/redis/index.js';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity, ConsentType } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
} from '../dto/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';
import { CreatorConsentService } from './creator-consent.service.js';

interface PlatformStats {
  totalFollowers: number;
  totalContent: number;
  totalViews: number;
  platformCount: number;
}

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly creatorConsentService: CreatorConsentService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async findById(creatorId: string): Promise<CreatorEntity | null> {
    return this.creatorRepo.findOne({ where: { id: creatorId } });
  }

  async findByIdOrFail(creatorId: string): Promise<CreatorEntity> {
    const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });

    if (!creator) {
      this.logger.debug('Creator not found', { creatorId });
      throw CreatorException.creatorNotFound();
    }

    return creator;
  }

  async findByIds(creatorIds: string[]): Promise<CreatorEntity[]> {
    if (creatorIds.length === 0) return [];

    return await this.creatorRepo.find({
      where: { id: In(creatorIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<CreatorEntity | null> {
    return this.creatorRepo.findOne({ where: { userId } });
  }

  async findByCategory(category: string): Promise<CreatorEntity[]> {
    return this.creatorRepo.find({
      where: { category },
      order: { createdAt: 'DESC' },
    });
  }

  async searchCreators(query: CreatorSearchQueryDto): Promise<PaginatedResult<CreatorSearchResultDto>> {
    try {
      const result = await this.creatorRepo.searchCreators(query);
      return {
        items: this.buildCreatorSearchResults(result.items),
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator search', { query }, CreatorException.creatorFetchError);
    }
  }

  async getCreatorById(creatorId: string): Promise<CreatorDetailDto> {
    try {
      // 캐시 조회
      const cached = await this.cacheService.getCreatorDetail(creatorId);
      if (cached) return cached;

      // DB 조회 및 DTO 생성
      const creator = await this.findByIdOrFail(creatorId);
      const platformStats = await this.getPlatformStatsWithCache(creatorId);
      const detailDto = this.buildCreatorDetail(creator, platformStats);

      // 결과 캐싱
      await this.cacheService.setCreatorDetail(creatorId, detailDto);
      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.handleServiceError(error, 'Creator detail fetch', { creatorId }, CreatorException.creatorFetchError);
    }
  }

  // ==================== 변경 메서드 ====================

  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<string> {
    try {
      // 중복 검증
      if (dto.name && dto.category) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { name: dto.name, category: dto.category },
        });
        if (existingCreator) throw CreatorException.creatorAlreadyExists();
      }

      // 엔티티 생성 및 저장
      const creatorEntity = new CreatorEntity();
      Object.assign(creatorEntity, dto);
      await this.creatorRepo.saveEntity(creatorEntity, transactionManager);

      // 캐시 무효화
      await this.cacheService.invalidateCreatorRelatedCaches(creatorEntity.id);
      return creatorEntity.id;
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator creation', { name: dto.name, category: dto.category }, CreatorException.creatorCreateError);
    }
  }

  async updateCreator(creatorId: string, dto: UpdateCreatorDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });
      if (!creator) throw CreatorException.creatorNotFound();

      // 표시명 중복 체크
      if (dto.displayName && dto.displayName !== creator.displayName) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { displayName: dto.displayName, category: creator.category, id: Not(creatorId) },
        });
        if (existingCreator) throw CreatorException.creatorAlreadyExists();
      }

      // 업데이트 및 캐시 무효화
      Object.assign(creator, dto);
      await this.creatorRepo.updateEntity(creator, transactionManager);
      await this.cacheService.invalidateCreatorRelatedCaches(creatorId);
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator update', { creatorId, updatedFields: Object.keys(dto) }, CreatorException.creatorUpdateError);
    }
  }

  async deleteCreator(creatorId: string): Promise<UpdateResult> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });
      if (!creator) throw CreatorException.creatorNotFound();

      const result = await this.creatorRepo.softDelete(creatorId);
      await this.cacheService.invalidateCreatorRelatedCaches(creatorId);
      return result;
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator deletion', { creatorId }, CreatorException.creatorDeleteError);
    }
  }

  // ==================== 동의 관리 메서드 (위임) ====================

  async hasValidConsents(creatorId: string): Promise<boolean> {
    return this.creatorConsentService.hasAnyConsent(creatorId);
  }

  async getActiveConsents(creatorId: string): Promise<ConsentType[]> {
    return this.creatorConsentService.getActiveConsents(creatorId);
  }

  async getActiveConsentsBatch(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    return this.creatorConsentService.getActiveConsentsBatch(creatorIds);
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.creatorRepo.count();
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private handleServiceError(
    error: unknown,
    operation: string,
    context: Record<string, unknown>,
    fallbackException: () => HttpException
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    throw fallbackException();
  }

  private async getPlatformStatsWithCache(creatorId: string): Promise<PlatformStats> {
    let stats = await this.cacheService.getPlatformStats(creatorId);
    if (!stats) {
      stats = await this.buildDetailedPlatformStats(creatorId);
      await this.cacheService.setPlatformStats(creatorId, stats);
    }
    return stats;
  }

  private async buildDetailedPlatformStats(creatorId: string): Promise<PlatformStats> {
    try {
      return await this.creatorPlatformService.getStatsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch platform stats', { creatorId, error });
      return { totalFollowers: 0, totalContent: 0, totalViews: 0, platformCount: 0 };
    }
  }

  private buildCreatorDetail(creator: CreatorEntity, platformStats: PlatformStats): CreatorDetailDto {
    const result: CreatorDetailDto = {
      id: creator.id,
      name: creator.name,
      displayName: creator.displayName,
      isVerified: creator.isVerified,
      category: creator.category,
      status: creator.status,
      verificationStatus: creator.verificationStatus,
      platformStats: {
        totalFollowers: platformStats.totalFollowers,
        totalContent: platformStats.totalContent,
        totalViews: platformStats.totalViews,
        platformCount: platformStats.platformCount,
      },
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };

    // 조건부 할당 (간소화)
    const optionalFields = {
      userId: creator.userId,
      avatar: creator.avatar,
      description: creator.description,
      tags: creator.tags,
      lastActivityAt: creator.lastActivityAt,
      socialLinks: creator.socialLinks,
    };

    Object.entries(optionalFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        (result as unknown as Record<string, unknown>)[key] = value;
      }
    });

    return result;
  }

  private buildCreatorSearchResults(creators: Partial<CreatorEntity>[]): CreatorSearchResultDto[] {
    return creators.map((creator) => ({
      id: creator.id!,
      name: creator.name!,
      displayName: creator.displayName!,
      avatar: creator.avatar,
      description: creator.description,
      isVerified: creator.isVerified!,
      category: creator.category!,
      tags: creator.tags,
      createdAt: creator.createdAt!,
    }));
  }
}
