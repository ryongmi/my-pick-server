import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In, UpdateResult, Not } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity, CreatorPlatformEntity, ConsentType } from '../entities/index.js';
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

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly creatorConsentService: CreatorConsentService
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

  async findByCategory(category: string): Promise<CreatorEntity[]> {
    return this.creatorRepo.find({
      where: { category },
      order: { createdAt: 'DESC' },
    });
  }

  async searchCreators(
    query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    try {
      const result = await this.creatorRepo.searchCreators(query);

      if (result.items.length === 0) {
        return { items: [], pageInfo: result.pageInfo };
      }

      const items = this.buildCreatorSearchResults(result.items);

      this.logger.debug('Creator search completed', {
        totalFound: result.pageInfo.totalItems,
        page: query.page,
        limit: query.limit,
        hasNameFilter: !!query.name,
        category: query.category,
      });

      return {
        items,
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      this.logger.error('Creator search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async getCreatorById(creatorId: string): Promise<CreatorDetailDto> {
    try {
      const creator = await this.findByIdOrFail(creatorId);
      const platformStats = await this.buildDetailedPlatformStats(creatorId);
      const detailDto = this.buildCreatorDetail(creator, platformStats);

      this.logger.debug('Creator detail fetched', {
        creatorId,
        name: creator.name,
        platformCount: platformStats.platformCount,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<void> {
    try {
      // 1. 사전 검증 (비즈니스 규칙)
      if (dto.name && dto.category) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { name: dto.name, category: dto.category },
        });

        if (existingCreator) {
          this.logger.warn('Creator creation failed: duplicate name', {
            name: dto.name,
            category: dto.category,
          });
          throw CreatorException.creatorAlreadyExists();
        }
      }

      // 2. 엔티티 생성
      const creatorEntity = new CreatorEntity();
      Object.assign(creatorEntity, dto);

      // 3. Creator 저장
      await this.creatorRepo.save(creatorEntity);

      // 4. 성공 로깅
      this.logger.log('Creator created successfully', {
        creatorId: creatorEntity.id,
        name: dto.name,
        category: dto.category,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: dto.name,
        category: dto.category,
      });

      throw CreatorException.creatorCreateError();
    }
  }

  async updateCreator(
    creatorId: string,
    dto: UpdateCreatorDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });

      if (!creator) {
        this.logger.warn('Creator update failed: creator not found', { creatorId });
        throw CreatorException.creatorNotFound();
      }

      // 이름 변경 시 중복 체크
      if (dto.name && dto.name !== creator.name) {
        const existingCreator = await this.creatorRepo.findOne({
          where: {
            name: dto.name,
            category: creator.category,
            id: Not(creatorId),
          },
        });

        if (existingCreator) {
          this.logger.warn('Creator update failed: duplicate name', {
            creatorId,
            newName: dto.name,
            category: creator.category,
          });
          throw CreatorException.creatorAlreadyExists();
        }
      }

      // 업데이트할 필드만 변경
      Object.assign(creator, dto);
      await this.creatorRepo.save(creator);

      this.logger.log('Creator updated successfully', {
        creatorId,
        name: creator.name,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        updatedFields: Object.keys(dto),
      });

      throw CreatorException.creatorUpdateError();
    }
  }

  async deleteCreator(creatorId: string): Promise<UpdateResult> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });

      if (!creator) {
        this.logger.warn('Creator deletion failed: creator not found', { creatorId });
        throw CreatorException.creatorNotFound();
      }

      this.logger.log('Creator deletion initiated', {
        creatorId,
        creatorName: creator.name,
      });

      // 소프트 삭제로 진행 (참조 무결성 유지)
      const result = await this.creatorRepo.softDelete(creatorId);

      this.logger.log('Creator deleted successfully', {
        creatorId,
        name: creator.name,
        category: creator.category,
        deletionType: 'soft',
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      throw CreatorException.creatorDeleteError();
    }
  }

  // ==================== 동의 관리 메서드 ====================

  /**
   * 크리에이터의 활성 동의 여부 확인
   */
  async hasValidConsents(creatorId: string): Promise<boolean> {
    try {
      return await this.creatorConsentService.hasAnyConsent(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to check creator consents', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      // 동의 확인 실패 시 false 반환 (보수적 접근)
      return false;
    }
  }

  /**
   * 크리에이터의 활성 동의 타입 목록 조회
   */
  async getActiveConsents(creatorId: string): Promise<ConsentType[]> {
    try {
      return await this.creatorConsentService.getActiveConsents(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch creator consents', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return [];
    }
  }

  /**
   * 여러 크리에이터의 활성 동의 목록 조회 (배치 처리)
   */
  async getActiveConsentsBatch(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    try {
      return await this.creatorConsentService.getActiveConsentsBatch(creatorIds);
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch creators consents batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });

      // 실패 시 빈 배열로 초기화된 Record 반환
      const result: Record<string, ConsentType[]> = {};
      creatorIds.forEach((id) => {
        result[id] = [];
      });
      return result;
    }
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.creatorRepo.count();
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async buildDetailedPlatformStats(creatorId: string): Promise<{
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    platformCount: number;
  }> {
    try {
      // Repository의 집계 쿼리 사용 (DB에서 직접 계산)
      const stats = await this.creatorPlatformService.getStatsByCreatorId(creatorId);
      return stats;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch platform stats, using default values', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      // 플랫폼 데이터 조회 실패 시 기본값 반환
      return {
        totalFollowers: 0,
        totalContent: 0,
        totalViews: 0,
        platformCount: 0,
      };
    }
  }

  private buildCreatorDetail(
    creator: CreatorEntity,
    platformStats: {
      totalFollowers: number;
      totalContent: number;
      totalViews: number;
      platformCount: number;
    }
  ): CreatorDetailDto {
    return {
      id: creator.id,
      userId: creator.userId,
      name: creator.name,
      displayName: creator.displayName,
      avatar: creator.avatar,
      description: creator.description,
      isVerified: creator.isVerified,
      category: creator.category,
      tags: creator.tags,
      platformStats: {
        totalFollowers: platformStats.totalFollowers,
        totalContent: platformStats.totalContent,
        totalViews: platformStats.totalViews,
        platformCount: platformStats.platformCount,
      },
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };
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
