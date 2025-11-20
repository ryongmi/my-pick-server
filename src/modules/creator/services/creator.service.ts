import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { In } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';

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
  CreatorDetailDto,
  CreatorUserDto,
  PlatformInfo,
} from '../dto/index.js';
import { PlatformType } from '../enums/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepository: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly userSubscriptionService: UserSubscriptionService,
    @Inject('AUTH_SERVICE') private readonly authServiceClient: ClientProxy
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
   * 크리에이터 상세 정보 조회 (플랫폼 + 사용자 정보 포함)
   * 관리자 페이지 상세 조회용
   */
  async getDetailById(id: string): Promise<CreatorDetailDto> {
    // 1. 크리에이터 기본 정보
    const creator = await this.findByIdOrFail(id);

    // 2. 플랫폼 정보와 사용자 정보 병렬 조회
    const [platforms, user] = await Promise.all([
      this.creatorPlatformService.findByCreatorId(id),
      this.getUserInfo(creator.userId),
    ]);

    // 3. CreatorDetailDto 생성
    const detail: CreatorDetailDto = Object.assign(new CreatorDetailDto(), {
      ...creator,
      platforms,
      user,
    });

    return detail;
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
          platformType: platform.platformType.toLowerCase() as PlatformType,
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

  /**
   * TCP 통신으로 auth-server에서 사용자 정보 조회
   */
  private async getUserInfo(userId: string): Promise<CreatorUserDto> {
    try {
      const user = await firstValueFrom(
        this.authServiceClient.send('user.find-by-id', { userId }).pipe(timeout(5000))
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImage: user.profileImage,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch user info for userId: ${userId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // 사용자 정보 조회 실패 시 기본값 반환
      return {
        id: userId,
        email: 'unknown@example.com',
        name: 'Unknown User',
      };
    }
  }

  // ==================== CREATOR DASHBOARD METHODS ====================

  /**
   * userId로 크리에이터 정보 조회 (단일)
   * 한 사용자가 여러 크리에이터를 가질 수 있지만, 대부분 하나만 가짐
   */
  async findOneByUserId(userId: string): Promise<CreatorEntity | null> {
    const creators = await this.findByUserId(userId);
    return creators.length > 0 ? creators[0]! : null;
  }

  /**
   * userId로 크리에이터 정보 조회 (없으면 예외)
   */
  async findOneByUserIdOrFail(userId: string): Promise<CreatorEntity> {
    const creator = await this.findOneByUserId(userId);
    if (!creator) {
      throw CreatorException.creatorNotFound();
    }
    return creator;
  }

  /**
   * 크리에이터 대시보드 통계
   * 총 콘텐츠 수, 총 조회수, 총 좋아요, 플랫폼 수 등
   */
  async getDashboardStats(
    creatorId: string
  ): Promise<{
    totalContents: number;
    totalViews: number;
    totalLikes: number;
    platformCount: number;
  }> {
    const creator = await this.findByIdOrFail(creatorId);
    const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);

    // 크리에이터 statistics 필드에서 통계 가져오기
    const stats = creator.statistics;

    return {
      totalContents: stats?.totalVideos || 0,
      totalViews: stats?.totalViews || 0,
      totalLikes: 0, // 현재 Creator 엔티티에 totalLikes 필드 없음
      platformCount: platforms.length,
    };
  }
}

