import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager, UpdateResult, In, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import { PlatformType } from '@common/enums/index.js';
import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentRepository } from '../repositories/index.js';
import { ContentEntity, ContentStatisticsEntity } from '../entities/index.js';
import {
  ContentDetailDto,
  CreateContentDto,
  UpdateContentDto,
  UpdateContentStatisticsDto,
} from '../dto/index.js';
import { ContentException } from '../exceptions/index.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly dataSource: DataSource,
    private readonly userInteractionService: UserInteractionService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findById(contentId: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOneById(contentId);
  }

  async findByIds(contentIds: string[]): Promise<ContentEntity[]> {
    if (contentIds.length === 0) return [];

    return this.contentRepo.find({
      where: { id: In(contentIds) },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByCreatorId(creatorId: string): Promise<ContentEntity[]> {
    return this.contentRepo.find({
      where: { creatorId },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByCreatorIds(creatorIds: string[]): Promise<ContentEntity[]> {
    if (creatorIds.length === 0) return [];
    
    return this.contentRepo.find({
      where: { creatorId: In(creatorIds) },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByPlatformId(platformId: string, platform: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOne({
      where: { platformId, platform: platform as PlatformType },
    });
  }

  async findByIdOrFail(contentId: string): Promise<ContentEntity> {
    const content = await this.findById(contentId);
    if (!content) {
      this.logger.warn('Content not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return content;
  }

  // 복합 조회 메서드들
  async getContentById(
    contentId: string,
    userId?: string,
  ): Promise<ContentDetailDto> {
    try {
      const content = await this.findByIdOrFail(contentId);

      const detailDto = plainToInstance(ContentDetailDto, content, {
        excludeExtraneousValues: true,
      });

      // UserInteractionService 연동하여 사용자별 상호작용 정보 추가
      if (userId) {
        try {
          detailDto.isBookmarked = await this.userInteractionService.isBookmarked(userId, contentId);
          detailDto.isLiked = await this.userInteractionService.isLiked(userId, contentId);
          const interaction = await this.userInteractionService.getInteractionDetail(userId, contentId);
          if (interaction) {
            if (interaction.watchedAt) detailDto.watchedAt = interaction.watchedAt;
            if (interaction.watchDuration) detailDto.watchDuration = interaction.watchDuration;
            if (interaction.rating) detailDto.rating = interaction.rating;
          }
        } catch (error: unknown) {
          this.logger.warn('Failed to fetch user interactions for content detail', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            contentId,
          });
          // 사용자 상호작용 정보 조회 실패 시 기본값 유지
        }
      }

      this.logger.debug('Content detail fetched', {
        contentId,
        userId,
        type: content.type,
        platform: content.platform,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createContent(
    dto: CreateContentDto,
    transactionManager?: EntityManager,
  ): Promise<string> {
    try {
      // 1. 사전 검증 (중복 확인)
      const existing = await this.contentRepo.findOne({
        where: { platformId: dto.platformId, platform: dto.platform as PlatformType }
      });
      if (existing) {
        this.logger.warn('Content creation failed: duplicate platform content', {
          platformId: dto.platformId,
          platform: dto.platform,
        });
        throw ContentException.contentAlreadyExists();
      }

      // 2. 엔티티 생성
      const content = new ContentEntity();
      Object.assign(content, {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
        url: dto.url,
        platform: dto.platform,
        platformId: dto.platformId,
        duration: dto.duration,
        publishedAt: new Date(dto.publishedAt),
        creatorId: dto.creatorId,
        language: dto.language,
        isLive: dto.isLive || false,
        quality: dto.quality,
        ageRestriction: dto.ageRestriction || false,
      });

      // 3. 저장 (BaseRepository 패턴)
      const savedContent = await this.contentRepo.saveEntity(content, transactionManager);

      // 4. 성공 로깅
      this.logger.log('Content created successfully', {
        contentId: savedContent.id,
        type: dto.type,
        platform: dto.platform,
        platformId: dto.platformId,
        creatorId: dto.creatorId,
      });

      return savedContent.id;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId: dto.platformId,
        platform: dto.platform,
        creatorId: dto.creatorId,
      });
      
      throw ContentException.contentCreateError();
    }
  }

  async updateContent(
    contentId: string,
    dto: UpdateContentDto,
    transactionManager?: EntityManager,
  ): Promise<void> {
    try {
      const content = await this.findByIdOrFail(contentId);

      // 업데이트할 필드만 변경
      Object.assign(content, dto);

      // BaseRepository 패턴 사용
      await this.contentRepo.updateEntity(content, transactionManager);

      this.logger.log('Content updated successfully', {
        contentId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async updateContentStatistics(
    contentId: string,
    dto: UpdateContentStatisticsDto,
  ): Promise<void> {
    try {
      // 1. 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // 2. 통계 엔티티 조회 또는 생성
      const statisticsRepo = this.dataSource.getRepository(ContentStatisticsEntity);
      let statistics = await statisticsRepo.findOne({ where: { contentId } });

      if (statistics) {
        Object.assign(statistics, dto);
      } else {
        // 통계가 없는 경우 새로 생성
        statistics = new ContentStatisticsEntity();
        statistics.contentId = contentId;
        Object.assign(statistics, dto);
      }

      // 3. 통계 저장
      await statisticsRepo.save(statistics);

      this.logger.log('Content statistics updated successfully', {
        contentId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content statistics update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async deleteContent(contentId: string): Promise<UpdateResult> {
    try {
      await this.findByIdOrFail(contentId);

      await this.contentRepo.delete(contentId);

      this.logger.log('Content deleted successfully', { contentId });

      return { affected: 1 } as UpdateResult;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  // ==================== 집계 메서드 ====================

  async countByCreatorId(creatorId: string): Promise<number> {
    return this.contentRepo.count({
      where: { creatorId },
    });
  }

  async updateContentDetails(
    contentId: string,
    updateData: Partial<Pick<ContentEntity, 'title' | 'description' | 'thumbnail' | 'language' | 'isLive' | 'quality' | 'ageRestriction'>>,
    transactionManager?: EntityManager,
  ): Promise<void> {
    try {
      // 1. 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // 2. 콘텐츠 정보 업데이트 (BaseRepository 패턴)
      const finalUpdateData: Partial<ContentEntity> = {
        ...updateData,
        updatedAt: new Date(),
      };

      const repo = transactionManager ? transactionManager.getRepository(ContentEntity) : this.contentRepo;
      await repo.update(contentId, finalUpdateData);

      this.logger.log('Content details updated successfully', {
        contentId,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content details update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }
}