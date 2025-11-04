import { Injectable, Logger } from '@nestjs/common';

import { In } from 'typeorm';

import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { UserSubscriptionService } from '@modules/user-subscription/services/user-subscription.service.js';
import type { ChannelInfo } from '@modules/creator-registration/entities/creator-registration.entity.js';

import { CreatorException } from '../exceptions/index.js';
import { CreatorRepository } from '../repositories/creator.repository.js';
import {
  CreatorEntity,
  CreatorProfile,
  CreatorStatistics,
  CreatorMetadata,
} from '../entities/creator.entity.js';
import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';
import {
  CreateCreatorDto,
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  PlatformInfo,
} from '../dto/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly userSubscriptionService: UserSubscriptionService
  ) {}

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
  async searchCreators(
    query: CreatorSearchQueryDto,
    userId?: string
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    const { items: creators, pageInfo } = await this.creatorRepository.searchCreators(
      query,
      userId
    );

    // 1. 모든 creatorId 추출
    const creatorIds = creators.map((c) => c.id);

    // 2. 일괄적으로 플랫폼 정보 조회 (N+1 쿼리 방지)
    const platformsMap = await this.getPlatformsForCreators(creatorIds);

    // 3. userId가 있으면 구독 정보 조회
    let subscribedCreatorIds: string[] | undefined;
    if (userId) {
      subscribedCreatorIds = await this.userSubscriptionService.getCreatorIds(userId);
    }

    // 4. DTO 변환 (구독 여부 포함)
    const items = creators.map((creator) => {
      const dto = this.toSearchResultDto(creator, platformsMap.get(creator.id) || []);

      // 구독 정보가 제공되었을 때만 isSubscribed 추가
      if (subscribedCreatorIds) {
        dto.isSubscribed = subscribedCreatorIds.includes(creator.id);
      }

      return dto;
    });

    return {
      items,
      pageInfo,
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

  /**
   * 여러 ID로 크리에이터 상세 정보 조회 (구독 목록용, 페이지네이션)
   */
  async findByIdsWithDetails(
    creatorIds: string[],
    options?: {
      page?: number;
      limit?: LimitType;
    }
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    if (creatorIds.length === 0) {
      return {
        items: [],
        pageInfo: {
          totalItems: 0,
          page: options?.page ?? 1,
          limit: (options?.limit ?? LimitType.THIRTY) as LimitType,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      };
    }

    const page = options?.page ?? 1;
    const limit = (options?.limit ?? LimitType.THIRTY) as LimitType;
    const offset = (page - 1) * limit;

    // 1. 페이지네이션 적용 (클라이언트 레벨)
    const paginatedIds = creatorIds.slice(offset, offset + limit);

    // 2. 크리에이터 조회
    const creators = await this.creatorRepository.find({
      where: {
        id: In(paginatedIds),
        isActive: true,
      },
    });

    // 3. 플랫폼 정보 조회
    const platformsMap = await this.getPlatformsForCreators(paginatedIds);

    // 4. DTO 변환 (isSubscribed는 항상 true로 설정 - 구독한 크리에이터만 조회)
    const items = creators.map((creator) => {
      const dto = this.toSearchResultDto(creator, platformsMap.get(creator.id) || []);
      dto.isSubscribed = true; // 구독한 크리에이터만 조회하므로 항상 true
      return dto;
    });

    // 5. 페이지네이션 메타 정보
    const totalPages = Math.ceil(creatorIds.length / limit);

    this.logger.debug('Found creators by IDs with details', {
      requestedCount: creatorIds.length,
      page,
      limit,
      returnedCount: items.length,
    });

    return {
      items,
      pageInfo: {
        totalItems: creatorIds.length,
        page,
        limit,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
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
  private toSearchResultDto(
    creator: CreatorEntity,
    platforms: CreatorPlatformEntity[] = []
  ): CreatorSearchResultDto {
    const result: CreatorSearchResultDto = {
      id: creator.id,
      name: creator.name,
      isActive: creator.isActive,
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

    // 플랫폼 정보 매핑
    if (platforms && platforms.length > 0) {
      result.platforms = platforms.map((platform) => {
        const platformInfo: PlatformInfo = {
          platformType: platform.platformType.toLowerCase() as 'youtube' | 'twitter',
          platformId: platform.platformId,
        };
        if (platform.platformUsername) {
          platformInfo.platformUsername = platform.platformUsername;
        }
        if (platform.platformUrl) {
          platformInfo.platformUrl = platform.platformUrl;
        }
        return platformInfo;
      });
    }

    return result;
  }

  /**
   * 여러 크리에이터의 플랫폼 정보를 일괄 조회 (N+1 방지)
   */
  private async getPlatformsForCreators(
    creatorIds: string[]
  ): Promise<Map<string, CreatorPlatformEntity[]>> {
    if (creatorIds.length === 0) {
      return new Map();
    }

    // 모든 크리에이터의 플랫폼 정보를 일괄 조회
    const allPlatforms = await Promise.all(
      creatorIds.map((creatorId) => this.creatorPlatformService.findByCreatorId(creatorId))
    );

    // Map으로 변환하여 O(1) 조회 가능하도록
    const platformsMap = new Map<string, CreatorPlatformEntity[]>();
    creatorIds.forEach((creatorId, index) => {
      const platforms = allPlatforms[index];
      if (platforms) {
        platformsMap.set(creatorId, platforms);
      }
    });

    return platformsMap;
  }
}
