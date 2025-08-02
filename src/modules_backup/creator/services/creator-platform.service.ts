import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import { PlatformType, SyncStatus } from '@common/enums/index.js';

import { CreatorPlatformRepository } from '../repositories/index.js';
import { CreatorPlatformEntity } from '../entities/index.js';
import { AddPlatformDto, CreatorPlatformDto, UpdatePlatformDto } from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorPlatformService {
  private readonly logger = new Logger(CreatorPlatformService.name);

  constructor(
    private readonly creatorPlatformRepo: CreatorPlatformRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    return this.creatorPlatformRepo.findByCreatorId(creatorId);
  }

  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformEntity[]> {
    return this.creatorPlatformRepo.findByCreatorIds(creatorIds);
  }

  async findById(platformId: string): Promise<CreatorPlatformEntity | null> {
    return this.creatorPlatformRepo.findOneById(platformId);
  }

  async findByIdOrFail(platformId: string): Promise<CreatorPlatformEntity> {
    const platform = await this.findById(platformId);
    if (!platform) {
      this.logger.warn('Platform not found', { platformId });
      throw CreatorException.platformNotFound();
    }
    return platform;
  }

  // ==================== PLATFORM 관리 메서드 ====================

  async addMultiplePlatformsToCreator(
    creatorId: string,
    platformDtos: AddPlatformDto[],
    transactionManager?: EntityManager
  ): Promise<void> {
    if (platformDtos.length === 0) {
      this.logger.debug('No platforms to add', { creatorId });
      return;
    }

    try {
      // 1. Creator 존재 확인 (Repository를 직접 사용하여 순환 의존성 방지)
      const creator = await this.creatorPlatformRepo.manager.findOne('creators', {
        where: { id: creatorId }
      });

      if (!creator) {
        this.logger.warn('Creator not found for multiple platforms addition', {
          creatorId,
        });
        throw CreatorException.creatorNotFound();
      }

      // 2. 배치 중복 플랫폼 확인
      const platformKeys = platformDtos.map((dto) => ({
        type: dto.type,
        platformId: dto.platformId,
      }));

      const existingPlatforms = await this.creatorPlatformRepo.find({
        where: platformKeys.map((key) => ({
          creatorId,
          type: key.type,
          platformId: key.platformId,
        })),
      });

      if (existingPlatforms.length > 0) {
        const duplicateInfo = existingPlatforms.map((p) => `${p.type}:${p.platformId}`).join(', ');
        this.logger.warn('Duplicate platforms found for creator', {
          creatorId,
          duplicatePlatforms: duplicateInfo,
          totalRequested: platformDtos.length,
          duplicateCount: existingPlatforms.length,
        });
        throw CreatorException.platformAlreadyExists();
      }

      // 3. Platform 엔티티들 배치 생성
      const platformEntities = platformDtos.map((dto) => {
        const platform = new CreatorPlatformEntity();
        Object.assign(platform, {
          creatorId,
          type: dto.type,
          platformId: dto.platformId,
          url: dto.url,
          followerCount: dto.followerCount || 0,
          contentCount: dto.contentCount || 0,
          totalViews: dto.totalViews || 0,
          isActive: dto.isActive ?? true,
        });
        return platform;
      });

      // 4. 배치 저장 (트랜잭션 내에서 처리)
      let savedPlatforms: CreatorPlatformEntity[];
      if (transactionManager) {
        // 기존 트랜잭션 사용
        savedPlatforms = await transactionManager.save(CreatorPlatformEntity, platformEntities);
      } else {
        // 새 트랜잭션 생성
        savedPlatforms = await this.creatorPlatformRepo.save(platformEntities);
      }

      this.logger.log('Multiple platforms added to creator successfully', {
        creatorId,
        creatorName: creator.name,
        platformCount: savedPlatforms.length,
        platformTypes: platformDtos.map((dto) => dto.type),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Add multiple platforms to creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformCount: platformDtos.length,
        platformTypes: platformDtos.map((dto) => dto.type),
      });

      throw CreatorException.platformCreateError();
    }
  }


  async createPlatform(
    data: {
      creatorId: string;
      type: PlatformType;
      platformId: string;
      url: string;
      displayName?: string;
      isActive: boolean;
      syncStatus: SyncStatus;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. Creator 존재 확인 (Repository를 직접 사용하여 순환 의존성 방지)
      const creator = await this.creatorPlatformRepo.manager.findOne('creators', {
        where: { id: data.creatorId }
      });

      if (!creator) {
        this.logger.warn('Creator not found for platform creation', {
          creatorId: data.creatorId,
        });
        throw CreatorException.creatorNotFound();
      }

      // 2. 중복 플랫폼 확인
      const existingPlatform = await this.creatorPlatformRepo.findOne({
        where: {
          creatorId: data.creatorId,
          type: data.type,
          platformId: data.platformId,
        },
      });

      if (existingPlatform) {
        this.logger.warn('Platform already exists for creator', {
          creatorId: data.creatorId,
          platformType: data.type,
          platformId: data.platformId,
        });
        throw CreatorException.platformAlreadyExists();
      }

      // 3. Platform 엔티티 생성
      const platform = new CreatorPlatformEntity();
      Object.assign(platform, {
        creatorId: data.creatorId,
        type: data.type,
        platformId: data.platformId,
        url: data.url,
        displayName: data.displayName,
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
        isActive: data.isActive,
        syncStatus: data.syncStatus,
      });

      // 4. 저장
      if (transactionManager) {
        await transactionManager.save(platform);
      } else {
        await this.creatorPlatformRepo.saveEntity(platform);
      }

      this.logger.log('Platform created successfully', {
        creatorId: data.creatorId,
        platformId: platform.id,
        platformType: data.type,
        creatorName: creator.name,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId: data.creatorId,
        platformType: data.type,
        platformId: data.platformId,
      });

      throw CreatorException.platformCreateError();
    }
  }




  // ==================== AGGREGATION METHODS ====================

  async addPlatformToCreator(
    creatorId: string,
    dto: AddPlatformDto,
    transactionManager?: EntityManager
  ): Promise<CreatorPlatformEntity> {
    try {
      // 1. Creator 존재 확인 (Repository를 직접 사용하여 순환 의존성 방지)
      const creator = await this.creatorPlatformRepo.manager.findOne('creators', {
        where: { id: creatorId }
      });

      if (!creator) {
        this.logger.warn('Creator not found for platform addition', {
          creatorId,
        });
        throw CreatorException.creatorNotFound();
      }

      // 2. 중복 플랫폼 확인
      const existingPlatform = await this.creatorPlatformRepo.findOne({
        where: {
          creatorId,
          type: dto.type,
          platformId: dto.platformId,
        },
      });

      if (existingPlatform) {
        this.logger.warn('Platform already exists for creator', {
          creatorId,
          type: dto.type,
          platformId: dto.platformId,
        });
        throw CreatorException.creatorPlatformAlreadyExists();
      }

      // 3. 플랫폼 엔티티 생성
      const platformEntity = new CreatorPlatformEntity();
      Object.assign(platformEntity, {
        creatorId,
        ...dto,
      });

      // 4. 플랫폼 저장
      const platform = await this.creatorPlatformRepo.saveEntity(platformEntity, transactionManager);

      // 5. 성공 로깅
      this.logger.log('Platform added to creator successfully', {
        creatorId,
        platformId: platform.id,
        type: dto.type,
        platformIdValue: dto.platformId,
        creatorName: creator.name,
      });

      return platform;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform addition failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type: dto.type,
        platformId: dto.platformId,
      });

      throw CreatorException.creatorPlatformCreateError();
    }
  }

  async updatePlatform(
    platformId: string,
    dto: UpdatePlatformDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const platform = await this.findByIdOrFail(platformId);

      // 업데이트할 필드만 변경
      Object.assign(platform, dto);
      await this.creatorPlatformRepo.saveEntity(platform, transactionManager);

      this.logger.log('Platform updated successfully', {
        platformId,
        creatorId: platform.creatorId,
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

      throw CreatorException.creatorPlatformUpdateError();
    }
  }

  async removePlatformFromCreator(platformId: string): Promise<void> {
    try {
      const platform = await this.findByIdOrFail(platformId);

      await this.creatorPlatformRepo.delete(platformId);

      this.logger.log('Platform removed from creator successfully', {
        platformId,
        creatorId: platform.creatorId,
        type: platform.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform removal failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.creatorPlatformDeleteError();
    }
  }

  async getAggregatedStats(creatorId: string): Promise<{
    totalFollowerCount: number;
    totalContentCount: number;
    totalViews: number;
  }> {
    const platforms = await this.findByCreatorId(creatorId);

    return {
      totalFollowerCount: platforms.reduce((sum, p) => sum + p.followerCount, 0),
      totalContentCount: platforms.reduce((sum, p) => sum + p.contentCount, 0),
      totalViews: platforms.reduce((sum, p) => sum + p.totalViews, 0),
    };
  }


}
