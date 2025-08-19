import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import { CreatorPlatformRepository, type PlatformStats } from '../repositories/index.js';
import { CreatorPlatformEntity } from '../entities/index.js';
import { CreatePlatformInternalDto, UpdatePlatformDto } from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorPlatformService {
  private readonly logger = new Logger(CreatorPlatformService.name);

  constructor(private readonly platformRepo: CreatorPlatformRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findById(platformId: string): Promise<CreatorPlatformEntity | null> {
    return this.platformRepo.findOne({ where: { id: platformId } });
  }

  async findByIdOrFail(platformId: string): Promise<CreatorPlatformEntity> {
    const platform = await this.platformRepo.findOne({ where: { id: platformId } });

    if (!platform) {
      this.logger.debug('Platform not found', { platformId });
      throw CreatorException.platformNotFound();
    }

    return platform;
  }

  /**
   * 크리에이터별 플랫폼 목록 조회 (BaseRepository 직접 사용)
   */
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    try {
      return await this.platformRepo.find({
        where: { creatorId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Platform fetch by creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 크리에이터별 활성 플랫폼만 조회 (BaseRepository 직접 사용)
   */
  async findActiveByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    try {
      return await this.platformRepo.find({
        where: { creatorId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Active platforms fetch by creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 플랫폼 타입별 조회 (BaseRepository 직접 사용)
   */
  async findByPlatformType(type: PlatformType): Promise<CreatorPlatformEntity[]> {
    try {
      return await this.platformRepo.find({
        where: { type, isActive: true },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Platforms fetch by type failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 플랫폼 타입별 조회 - findByType 별칭
   */
  async findByType(type: PlatformType, includeInactive = false): Promise<CreatorPlatformEntity[]> {
    try {
      const where = includeInactive ? { type } : { type, isActive: true };
      return await this.platformRepo.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Platforms fetch by type failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        includeInactive,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 크리에이터의 특정 플랫폼 타입 조회
   */
  async findByCreatorIdAndType(
    creatorId: string,
    type: PlatformType,
    includeCreator = false
  ): Promise<CreatorPlatformEntity | null> {
    try {
      return await this.platformRepo.findOne({
        where: { creatorId, type },
        relations: includeCreator ? ['creator'] : [],
      });
    } catch (error: unknown) {
      this.logger.error('Platform fetch by creator and type failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 크리에이터의 플랫폼 존재 확인 (BaseRepository 직접 사용)
   */
  async hasActivePlatforms(creatorId: string): Promise<boolean> {
    try {
      const count = await this.platformRepo.count({
        where: { creatorId, isActive: true },
      });
      return count > 0;
    } catch (error: unknown) {
      this.logger.error('Platform existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== 배치 처리 메서드 (Repository 사용) ====================

  /**
   * 여러 크리에이터의 플랫폼 목록 조회 (배치 처리)
   */
  async findByCreatorIds(creatorIds: string[]): Promise<Record<string, CreatorPlatformEntity[]>> {
    try {
      return await this.platformRepo.findByCreatorIds(creatorIds);
    } catch (error: unknown) {
      this.logger.error('Platforms batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 여러 크리에이터의 활성 플랫폼 조회 (배치 처리)
   */
  async findActiveByCreatorIds(
    creatorIds: string[]
  ): Promise<Record<string, CreatorPlatformEntity[]>> {
    try {
      return await this.platformRepo.findActiveByCreatorIds(creatorIds);
    } catch (error: unknown) {
      this.logger.error('Active platforms batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== 통계 집계 메서드 (Repository 사용) ====================

  /**
   * 크리에이터별 플랫폼 통계 집계 (복잡한 쿼리)
   */
  async getStatsByCreatorId(creatorId: string): Promise<PlatformStats> {
    try {
      return await this.platformRepo.getStatsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Platform stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 여러 크리에이터의 플랫폼 통계 집계 (배치 처리)
   */
  async getStatsByCreatorIds(creatorIds: string[]): Promise<Record<string, PlatformStats>> {
    try {
      return await this.platformRepo.getStatsByCreatorIds(creatorIds);
    } catch (error: unknown) {
      this.logger.error('Platform stats batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createPlatform(
    dto: CreatePlatformInternalDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 사전 검증 (비즈니스 규칙)
      // 중복 체크 등의 로직 추가 가능

      // 2. 엔티티 생성
      const platformEntity = new CreatorPlatformEntity();
      Object.assign(platformEntity, dto);

      // 3. Platform 저장
      await this.platformRepo.saveEntity(platformEntity, transactionManager);

      // 4. 성공 로깅
      this.logger.log('Platform created successfully', {
        platformId: platformEntity.id,
        creatorId: dto.creatorId,
        type: dto.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId: dto.creatorId,
        type: dto.type,
      });

      throw CreatorException.platformCreateError();
    }
  }

  async updatePlatform(
    platformId: string,
    dto: UpdatePlatformDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const platform = await this.platformRepo.findOne({ where: { id: platformId } });

      if (!platform) {
        this.logger.warn('Platform update failed: platform not found', { platformId });
        throw CreatorException.platformNotFound();
      }

      // 업데이트할 필드만 변경
      Object.assign(platform, dto);
      await this.platformRepo.updateEntity(platform, transactionManager);

      this.logger.log('Platform updated successfully', {
        platformId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        updatedFields: Object.keys(dto),
      });

      throw CreatorException.platformUpdateError();
    }
  }

  async deactivatePlatform(platformId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const platform = await this.platformRepo.findOne({ where: { id: platformId } });

      if (!platform) {
        this.logger.warn('Platform deactivation failed: platform not found', { platformId });
        throw CreatorException.platformNotFound();
      }

      this.logger.log('Platform deactivation initiated', {
        platformId,
        creatorId: platform.creatorId,
      });

      // 소프트 비활성화 
      const _result = await (this.platformRepo as unknown as { softDeleteEntity: (id: string, manager?: EntityManager) => Promise<unknown> }).softDeleteEntity(platformId, transactionManager);

      this.logger.log('Platform deactivated successfully', {
        platformId,
        creatorId: platform.creatorId,
        deletionType: 'soft',
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform deactivation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformDeleteError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================
}
