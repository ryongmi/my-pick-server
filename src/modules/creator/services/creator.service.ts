import { Injectable, Logger } from '@nestjs/common';

import { LimitType } from '@krgeobuk/core/enum';
import { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorException } from '../exceptions/index.js';
import { CreatorRepository } from '../repositories/creator.repository.js';
import {
  CreatorEntity,
  CreatorProfile,
  CreatorStatistics,
  CreatorMetadata,
} from '../entities/creator.entity.js';
import { CreateCreatorDto, CreatorSearchQueryDto, CreatorSearchResultDto } from '../dto/index.js';
import type { ChannelInfo } from '../../creator-application/entities/creator-application.entity.js';

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(private readonly creatorRepository: CreatorRepository) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * ID로 크리에이터 조회
   */
  async findById(id: string): Promise<CreatorEntity | null> {
    return this.creatorRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * ID로 크리에이터 조회 (없으면 예외 발생)
   */
  async findByIdOrFail(id: string): Promise<CreatorEntity> {
    const creator = await this.findById(id);
    if (!creator) {
      throw CreatorException.creatorNotFound();
    }
    return creator;
  }

  /**
   * 이름으로 크리에이터 조회
   */
  async findByName(name: string): Promise<CreatorEntity | null> {
    return this.creatorRepository.findByName(name);
  }

  /**
   * 활성화된 크리에이터 목록 조회
   */
  async findActive(): Promise<CreatorEntity[]> {
    return this.creatorRepository.findActive();
  }

  /**
   * 크리에이터 검색 (페이지네이션)
   */
  async searchCreators(query: CreatorSearchQueryDto): Promise<{
    items: CreatorSearchResultDto[];
    pageInfo: {
      totalItems: number;
      page: number;
      limit: LimitType;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }> {
    const [creators, total] = await this.creatorRepository.searchCreators(query);

    const items = creators.map((creator) => this.toSearchResultDto(creator));

    const page = query.page || 1;
    const limit = query.limit || LimitType.THIRTY;

    return {
      items,
      pageInfo: {
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasPreviousPage: page > 1,
        hasNextPage: page < Math.ceil(total / limit),
      },
    };
  }

  /**
   * 크리에이터 생성
   */
  async createCreator(dto: CreateCreatorDto): Promise<CreatorEntity> {
    // 중복 이름 체크
    const existing = await this.findByName(dto.name);
    if (existing) {
      throw CreatorException.creatorAlreadyExists();
    }

    const creatorData: {
      name: string;
      isActive: boolean;
      description?: string;
      profileImageUrl?: string;
    } = {
      name: dto.name,
      isActive: true,
    };
    if (dto.description !== undefined) {
      creatorData.description = dto.description;
    }
    if (dto.profileImageUrl !== undefined) {
      creatorData.profileImageUrl = dto.profileImageUrl;
    }

    const creator = this.creatorRepository.create(creatorData);

    const saved = await this.creatorRepository.save(creator);

    this.logger.log('Creator created successfully', {
      creatorId: saved.id,
      name: saved.name,
    });

    return saved;
  }

  /**
   * 크리에이터 정보 수정
   */
  async updateCreator(
    id: string,
    updates: {
      name?: string;
      description?: string;
      profileImageUrl?: string;
    }
  ): Promise<void> {
    const creator = await this.findByIdOrFail(id);

    // 이름 변경 시 중복 체크
    if (updates.name && updates.name !== creator.name) {
      const existing = await this.findByName(updates.name);
      if (existing) {
        throw CreatorException.creatorAlreadyExists();
      }
    }

    await this.creatorRepository.update(id, updates);

    this.logger.log('Creator updated successfully', {
      creatorId: id,
      updates: Object.keys(updates),
    });
  }

  /**
   * 크리에이터 비활성화
   */
  async deactivateCreator(id: string): Promise<void> {
    await this.findByIdOrFail(id);
    await this.creatorRepository.update(id, { isActive: false });

    this.logger.log('Creator deactivated', { creatorId: id });
  }

  // ==================== EXTENDED METHODS (신규 추가) ====================

  /**
   * 신청으로부터 Creator 생성 (승인 시 사용)
   */
  async createFromApplication(
    userId: string,
    applicationId: string,
    channelInfo: ChannelInfo
  ): Promise<CreatorEntity> {
    // 중복 이름 체크
    const existing = await this.findByName(channelInfo.channelName);
    if (existing) {
      throw CreatorException.creatorAlreadyExists();
    }

    const creatorData: any = {
      userId,
      name: channelInfo.channelName,
      isActive: true,
    };

    // 기본 필드 (하위 호환)
    if (channelInfo.description) {
      creatorData.description = channelInfo.description;
    }
    if (channelInfo.thumbnailUrl) {
      creatorData.profileImageUrl = channelInfo.thumbnailUrl;
    }

    // Profile (JSON)
    const profile: CreatorProfile = {
      displayName: channelInfo.channelName,
    };
    if (channelInfo.customUrl) {
      profile.customUrl = channelInfo.customUrl;
    }
    if (channelInfo.country) {
      profile.country = channelInfo.country;
    }
    if (channelInfo.thumbnailUrl) {
      profile.profileImages = {
        high: channelInfo.thumbnailUrl,
      };
    }
    creatorData.profile = profile;

    // Statistics (JSON)
    const statistics: CreatorStatistics = {
      totalSubscribers: channelInfo.subscriberCount || 0,
      totalVideos: channelInfo.videoCount || 0,
      totalViews: 0, // 추후 동기화 시 업데이트
      lastUpdatedAt: new Date().toISOString(),
    };
    creatorData.statistics = statistics;

    // Metadata (JSON)
    const metadata: CreatorMetadata = {
      applicationId,
      firstSyncedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };
    if (channelInfo.publishedAt) {
      metadata.platformCreatedAt = channelInfo.publishedAt;
    }
    creatorData.metadata = metadata;

    const creator = this.creatorRepository.create(creatorData);
    const saved = await this.creatorRepository.save(creator);
    const savedEntity = (Array.isArray(saved) ? saved[0] : saved) as CreatorEntity;

    this.logger.log('Creator created from application', {
      creatorId: savedEntity.id,
      userId,
      applicationId,
      channelName: channelInfo.channelName,
      subscribers: channelInfo.subscriberCount,
    });

    return savedEntity;
  }

  /**
   * 통계 정보 업데이트 (YouTube 동기화 시 호출)
   */
  async updateStatistics(
    creatorId: string,
    statisticsUpdate: Partial<CreatorStatistics>
  ): Promise<void> {
    const creator = await this.findByIdOrFail(creatorId);

    const currentStats = creator.statistics || {
      totalSubscribers: 0,
      totalVideos: 0,
      totalViews: 0,
      lastUpdatedAt: new Date().toISOString(),
    };

    const updatedStats: CreatorStatistics = {
      ...currentStats,
      ...statisticsUpdate,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.creatorRepository.update(creatorId, {
      statistics: updatedStats as any,
    });

    this.logger.debug('Creator statistics updated', {
      creatorId,
      subscribers: updatedStats.totalSubscribers,
      videos: updatedStats.totalVideos,
    });
  }

  /**
   * 프로필 정보 업데이트
   */
  async updateProfile(creatorId: string, profileUpdate: Partial<CreatorProfile>): Promise<void> {
    const creator = await this.findByIdOrFail(creatorId);

    const currentProfile = creator.profile || {};

    const updatedProfile: CreatorProfile = {
      ...currentProfile,
      ...profileUpdate,
    };

    await this.creatorRepository.update(creatorId, {
      profile: updatedProfile as any,
    });

    this.logger.debug('Creator profile updated', { creatorId });
  }

  /**
   * 메타데이터 업데이트
   */
  async updateMetadata(creatorId: string, metadataUpdate: Partial<CreatorMetadata>): Promise<void> {
    const creator = await this.findByIdOrFail(creatorId);

    const currentMetadata = creator.metadata || {};

    const updatedMetadata: CreatorMetadata = {
      ...currentMetadata,
      ...metadataUpdate,
    };

    await this.creatorRepository.update(creatorId, {
      metadata: updatedMetadata as any,
    });

    this.logger.debug('Creator metadata updated', { creatorId });
  }

  /**
   * 소유권 검증 - 사용자가 이 크리에이터를 소유하고 있는지 확인
   */
  async verifyOwnership(creatorId: string, userId: string): Promise<boolean> {
    const creator = await this.findById(creatorId);
    if (!creator) {
      return false;
    }
    return creator.userId === userId;
  }

  /**
   * 소유권 검증 (실패 시 예외 발생)
   */
  async verifyOwnershipOrFail(creatorId: string, userId: string): Promise<void> {
    const isOwner = await this.verifyOwnership(creatorId, userId);
    if (!isOwner) {
      throw CreatorException.notCreatorOwner();
    }
  }

  /**
   * 사용자가 소유한 크리에이터 목록 조회
   */
  async findByUserId(userId: string): Promise<CreatorEntity[]> {
    return this.creatorRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * CreatorEntity를 CreatorSearchResultDto로 변환
   */
  private toSearchResultDto(creator: CreatorEntity): CreatorSearchResultDto {
    const result: CreatorSearchResultDto = {
      id: creator.id,
      name: creator.name,
      isActive: creator.isActive,
      platformCount: 0, // TODO: CreatorPlatformService와 연동 필요
      createdAt: creator.createdAt,
    };

    if (creator.description) {
      result.description = creator.description;
    }
    if (creator.profileImageUrl) {
      result.profileImageUrl = creator.profileImageUrl;
    }
    if (creator.statistics?.totalSubscribers !== undefined) {
      result.subscriberCount = creator.statistics.totalSubscribers;
    }
    if (creator.statistics?.totalVideos !== undefined) {
      result.videoCount = creator.statistics.totalVideos;
    }
    if (creator.statistics?.totalViews !== undefined) {
      result.totalViews = creator.statistics.totalViews;
    }

    return result;
  }
}
