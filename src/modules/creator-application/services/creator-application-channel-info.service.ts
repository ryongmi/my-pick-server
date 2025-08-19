import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CreatorApplicationChannelInfoRepository } from '../repositories/index.js';
import { CreatorApplicationChannelInfoEntity } from '../entities/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';

export interface CreateChannelInfoDto {
  platform: string;
  channelId: string;
  channelUrl: string;
  subscriberCount: number;
  contentCategory: string;
  description: string;
}

export interface UpdateChannelInfoDto {
  platform?: string;
  channelId?: string;
  channelUrl?: string;
  subscriberCount?: number;
  contentCategory?: string;
  description?: string;
}

@Injectable()
export class CreatorApplicationChannelInfoService {
  private readonly logger = new Logger(CreatorApplicationChannelInfoService.name);

  constructor(
    private readonly channelInfoRepo: CreatorApplicationChannelInfoRepository,
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByApplicationId(applicationId: string): Promise<CreatorApplicationChannelInfoEntity | null> {
    try {
      return await this.channelInfoRepo.findByApplicationId(applicationId);
    } catch (error: unknown) {
      this.logger.error('Channel info fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      // 조회 실패 시 null 반환 (orchestration에서 처리)
      return null;
    }
  }

  async findByApplicationIdOrFail(applicationId: string): Promise<CreatorApplicationChannelInfoEntity> {
    const channelInfo = await this.findByApplicationId(applicationId);
    if (!channelInfo) {
      this.logger.warn('Channel info not found', { applicationId });
      throw CreatorApplicationException.channelInfoNotFound();
    }
    return channelInfo;
  }

  // ==================== 변경 메서드 ====================

  async createChannelInfo(
    applicationId: string,
    dto: CreateChannelInfoDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 중복 확인
      const existing = await this.findByApplicationId(applicationId);
      if (existing) {
        this.logger.warn('Channel info already exists', { applicationId });
        throw CreatorApplicationException.channelInfoAlreadyExists();
      }

      // 엔티티 생성
      const channelInfo = this.channelInfoRepo.create({
        applicationId,
        platform: dto.platform,
        channelId: dto.channelId,
        channelUrl: dto.channelUrl,
        subscriberCount: dto.subscriberCount,
        contentCategory: dto.contentCategory,
        description: dto.description,
      });

      // 저장
      await this.channelInfoRepo.saveEntity(channelInfo, transactionManager);

      this.logger.log('Channel info created successfully', {
        applicationId,
        platform: dto.platform,
        channelId: dto.channelId,
        subscriberCount: dto.subscriberCount,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Channel info creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        dto,
      });
      throw CreatorApplicationException.channelInfoCreateError();
    }
  }

  async updateChannelInfo(
    applicationId: string,
    dto: UpdateChannelInfoDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const channelInfo = await this.findByApplicationIdOrFail(applicationId);

      // 업데이트할 필드만 변경
      Object.assign(channelInfo, dto);

      // 저장
      await this.channelInfoRepo.updateEntity(channelInfo, transactionManager);

      this.logger.log('Channel info updated successfully', {
        applicationId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Channel info update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        dto,
      });
      throw CreatorApplicationException.channelInfoUpdateError();
    }
  }

  async deleteByApplicationId(
    applicationId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      if (transactionManager) {
        await transactionManager.delete('creator_application_channel_info', { applicationId });
      } else {
        await this.channelInfoRepo.delete({ applicationId });
      }

      this.logger.log('Channel info deleted successfully', { applicationId });
    } catch (error: unknown) {
      this.logger.error('Channel info deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw CreatorApplicationException.channelInfoDeleteError();
    }
  }
}