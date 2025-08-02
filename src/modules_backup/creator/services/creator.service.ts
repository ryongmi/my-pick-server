import { Injectable, Logger, HttpException } from '@nestjs/common';
import { EntityManager, In, UpdateResult, Not } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity } from '../entities/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
} from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(private readonly creatorRepo: CreatorRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findById(creatorId: string): Promise<CreatorEntity | null> {
    try {
      return await this.creatorRepo.findOneById(creatorId);
    } catch (error: unknown) {
      this.logger.error('Creator findById failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async findByIdOrFail(creatorId: string): Promise<CreatorEntity> {
    const creator = await this.findById(creatorId);
    if (!creator) {
      this.logger.warn('Creator not found', { creatorId });
      throw CreatorException.creatorNotFound();
    }
    return creator;
  }

  async findByIds(creatorIds: string[]): Promise<CreatorEntity[]> {
    if (creatorIds.length === 0) return [];

    try {
      return await this.creatorRepo.find({
        where: { id: In(creatorIds) },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Creator findByIds failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async findByCategory(category: string): Promise<CreatorEntity[]> {
    try {
      return await this.creatorRepo.find({
        where: { category },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Creator findByCategory failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async searchCreators(
    query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<Partial<CreatorEntity>>> {
    try {
      const result = await this.creatorRepo.searchCreators(query);

      this.logger.debug('Creator search completed', {
        totalFound: result.pageInfo.totalItems,
        page: query.page,
        limit: query.limit,
        hasNameFilter: !!query.name,
        category: query.category,
      });

      return result;
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

      const detailDto = plainToInstance(CreatorDetailDto, creator, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Creator detail fetched', {
        creatorId,
        name: creator.name,
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

  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<CreatorEntity> {
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
      const creator = await this.creatorRepo.saveEntity(creatorEntity, transactionManager);

      // 4. 성공 로깅
      this.logger.log('Creator created successfully', {
        creatorId: creator.id,
        name: dto.name,
        category: dto.category,
      });

      return creator;
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
      const creator = await this.creatorRepo.findOneById(creatorId);

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
      await this.creatorRepo.saveEntity(creator, transactionManager);

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
      const creator = await this.creatorRepo.findOneById(creatorId);

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

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.creatorRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.error('Failed to get total creator count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private buildCreatorSearchResults(
    creators: Partial<CreatorEntity>[]
  ): CreatorSearchResultDto[] {
    return creators.map((creator) => ({
      id: creator.id!,
      name: creator.name!,
      displayName: creator.displayName!,
      avatar: creator.avatar || '',
      description: creator.description,
      isVerified: creator.isVerified!,
      category: creator.category!,
      tags: creator.tags,
      createdAt: creator.createdAt!,
    }));
  }
}