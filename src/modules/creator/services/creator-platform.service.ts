import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In } from 'typeorm';

import { CreatorPlatformRepository } from '../repositories/index.js';
import { CreatorPlatformEntity } from '../entities/index.js';
import { CreatePlatformDto, UpdatePlatformDto } from '../dto/index.js';
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

  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    return this.platformRepo.find({
      where: { creatorId },
    });
  }

  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformEntity[]> {
    if (creatorIds.length === 0) return [];

    return this.platformRepo.find({
      where: { creatorId: In(creatorIds) },
    });
  }

  // ==================== 변경 메서드 ====================

  async createPlatform(
    dto: CreatePlatformDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 사전 검증 (비즈니스 규칙)
      // 중복 체크 등의 로직 추가 가능

      // 2. 엔티티 생성
      const platformEntity = new CreatorPlatformEntity();
      Object.assign(platformEntity, dto);

      // 3. Platform 저장
      await this.platformRepo.save(platformEntity);

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
      await this.platformRepo.save(platform);

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
      const result = await this.platformRepo.softDelete(platformId);

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
