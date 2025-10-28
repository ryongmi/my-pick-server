import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { firstValueFrom } from 'rxjs';

import { LimitType } from '@krgeobuk/core/enum';
// import { UserTcpPatterns } from '@krgeobuk/user/tcp';

import { PlatformType } from '@common/enums/index.js';

import { ContentException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { ContentRepository } from '../repositories/content.repository.js';
import { ContentEntity, ContentStatistics, ContentSyncInfo } from '../entities/content.entity.js';
import { ContentType } from '../enums/index.js';
import { ContentWithCreatorDto, CreatorInfo } from '../dto/content-response.dto.js';
import { CreatorEntity } from '../../creator/entities/creator.entity.js';

export interface CreateContentInput {
  type: ContentType;
  title: string;
  description?: string;
  thumbnail: string;
  url: string;
  platform: PlatformType;
  platformId: string;
  duration?: number;
  publishedAt: Date;
  creatorId: string;
  language?: string;
  isLive?: boolean;
  quality?: 'sd' | 'hd' | '4k';
  ageRestriction?: boolean;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepository: ContentRepository,
    // 순환 참조 방지를 위해 Inject + forwardRef 사용
    @Inject(forwardRef(() => CreatorService))
    private readonly creatorService: CreatorService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * ID로 콘텐츠 조회
   */
  async findById(id: string): Promise<ContentEntity | null> {
    return this.contentRepository.findOne({
      where: { id, status: 'active' },
    });
  }

  /**
   * ID로 콘텐츠 조회 (없으면 예외 발생)
   */
  async findByIdOrFail(id: string): Promise<ContentEntity> {
    const content = await this.findById(id);
    if (!content) {
      throw ContentException.contentNotFound();
    }
    return content;
  }

  /**
   * 플랫폼 타입과 플랫폼 ID로 콘텐츠 조회
   */
  async findByPlatformAndId(
    platform: PlatformType,
    platformId: string
  ): Promise<ContentEntity | null> {
    return this.contentRepository.findByPlatformAndId(platform, platformId);
  }

  /**
   * 크리에이터의 콘텐츠 목록 조회
   */
  async findByCreatorId(
    creatorId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<ContentEntity[]> {
    return this.contentRepository.findByCreatorId(creatorId, options);
  }

  /**
   * 크리에이터와 함께 콘텐츠 조회
   */
  async findWithCreator(contentId: string): Promise<ContentWithCreatorDto | null> {
    const content = await this.findById(contentId);
    if (!content) {
      return null;
    }

    // Creator 정보 조회
    const creator = await this.creatorService.findById(content.creatorId);

    // User 정보 조회 (TCP 통신)
    const user = await this.fetchUserForCreator(content.creatorId);

    const creatorInfo: CreatorInfo = {
      id: creator?.id || content.creatorId,
      name: creator?.name || 'Unknown',
    };

    if (creator?.profile?.displayName) {
      creatorInfo.displayName = creator.profile.displayName;
    }
    if (creator?.profileImageUrl) {
      creatorInfo.profileImageUrl = creator.profileImageUrl;
    }
    if (user) {
      creatorInfo.user = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      if (user.profileImage) {
        creatorInfo.user.profileImage = user.profileImage;
      }
    }

    return {
      id: content.id,
      type: content.type,
      title: content.title,
      description: content.description ?? '',
      thumbnail: content.thumbnail,
      url: content.url,
      platform: content.platform,
      platformId: content.platformId,
      duration: content.duration ?? 0,
      publishedAt: content.publishedAt.toISOString(),
      language: content.language ?? 'ko',
      isLive: content.isLive,
      quality: content.quality!,
      ageRestriction: content.ageRestriction,
      status: content.status,
      statistics: content.statistics!,
      syncInfo: content.syncInfo!,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
      deletedAt: content.deletedAt ? content.deletedAt.toISOString() : null,
      creator: creatorInfo,
    };
  }

  /**
   * 콘텐츠 생성 (YouTube 동기화용)
   */
  async createContent(dto: CreateContentInput): Promise<ContentEntity> {
    // 중복 콘텐츠 체크
    const existing = await this.findByPlatformAndId(dto.platform, dto.platformId);
    if (existing) {
      this.logger.warn('Content already exists', {
        platform: dto.platform,
        platformId: dto.platformId,
      });
      return existing;
    }

    // 외래키 검증: Creator가 존재하는지 확인
    await this.creatorService.findByIdOrFail(dto.creatorId);

    const contentData: {
      type: ContentType;
      title: string;
      thumbnail: string;
      url: string;
      platform: PlatformType;
      platformId: string;
      publishedAt: Date;
      creatorId: string;
      isLive: boolean;
      ageRestriction: boolean;
      status: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed';
      statistics: ContentStatistics;
      syncInfo: ContentSyncInfo;
      description?: string;
      duration?: number;
      language?: string;
      quality?: 'sd' | 'hd' | '4k';
    } = {
      type: dto.type,
      title: dto.title,
      thumbnail: dto.thumbnail,
      url: dto.url,
      platform: dto.platform,
      platformId: dto.platformId,
      publishedAt: dto.publishedAt,
      creatorId: dto.creatorId,
      isLive: dto.isLive ?? false,
      ageRestriction: dto.ageRestriction ?? false,
      status: 'active',
      statistics: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        updatedAt: new Date().toISOString(),
      },
      syncInfo: {
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'completed',
      },
    };
    if (dto.description !== undefined) {
      contentData.description = dto.description;
    }
    if (dto.duration !== undefined) {
      contentData.duration = dto.duration;
    }
    if (dto.language !== undefined) {
      contentData.language = dto.language;
    }
    if (dto.quality !== undefined) {
      contentData.quality = dto.quality;
    }

    const content = this.contentRepository.create(contentData);

    const saved = await this.contentRepository.save(content);

    this.logger.log('Content created successfully', {
      contentId: saved.id,
      platform: saved.platform,
      platformId: saved.platformId,
    });

    return saved;
  }

  /**
   * 콘텐츠 배치 생성 (YouTube 동기화용)
   */
  async createBatch(dtos: CreateContentInput[]): Promise<ContentEntity[]> {
    const contents = dtos.map((dto) => {
      const contentData: {
        type: ContentType;
        title: string;
        thumbnail: string;
        url: string;
        platform: PlatformType;
        platformId: string;
        publishedAt: Date;
        creatorId: string;
        isLive: boolean;
        ageRestriction: boolean;
        status: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed';
        statistics: ContentStatistics;
        syncInfo: ContentSyncInfo;
        description?: string;
        duration?: number;
        language?: string;
        quality?: 'sd' | 'hd' | '4k';
      } = {
        type: dto.type,
        title: dto.title,
        thumbnail: dto.thumbnail,
        url: dto.url,
        platform: dto.platform,
        platformId: dto.platformId,
        publishedAt: dto.publishedAt,
        creatorId: dto.creatorId,
        isLive: dto.isLive ?? false,
        ageRestriction: dto.ageRestriction ?? false,
        status: 'active',
        statistics: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          engagementRate: 0,
          updatedAt: new Date().toISOString(),
        },
        syncInfo: {
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'completed',
        },
      };
      if (dto.description !== undefined) {
        contentData.description = dto.description;
      }
      if (dto.duration !== undefined) {
        contentData.duration = dto.duration;
      }
      if (dto.language !== undefined) {
        contentData.language = dto.language;
      }
      if (dto.quality !== undefined) {
        contentData.quality = dto.quality;
      }

      return this.contentRepository.create(contentData);
    });

    const saved = await this.contentRepository.save(contents);

    // const saved = await this.contentRepository.saveBatch(contents);

    this.logger.log('Content batch created', { count: saved.length });

    return saved;
  }

  /**
   * 통계 정보 업데이트
   */
  async updateStatistics(id: string, statistics: Partial<ContentStatistics>): Promise<void> {
    const content = await this.findByIdOrFail(id);

    const updatedStats: ContentStatistics = {
      views: statistics.views ?? content.statistics?.views ?? 0,
      likes: statistics.likes ?? content.statistics?.likes ?? 0,
      comments: statistics.comments ?? content.statistics?.comments ?? 0,
      shares: statistics.shares ?? content.statistics?.shares ?? 0,
      engagementRate: statistics.engagementRate ?? content.statistics?.engagementRate ?? 0,
      updatedAt: new Date().toISOString(),
    };

    await this.contentRepository.updateStatistics(id, updatedStats);

    this.logger.debug('Content statistics updated', { contentId: id });
  }

  /**
   * 동기화 정보 업데이트
   */
  async updateSyncInfo(id: string, syncInfo: Partial<ContentSyncInfo>): Promise<void> {
    await this.findByIdOrFail(id);
    await this.contentRepository.updateSyncInfo(id, syncInfo);

    this.logger.debug('Content sync info updated', { contentId: id });
  }

  /**
   * 콘텐츠 상태 변경
   */
  async updateStatus(
    id: string,
    status: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed'
  ): Promise<void> {
    await this.findByIdOrFail(id);
    await this.contentRepository.update(id, { status });

    this.logger.log('Content status updated', { contentId: id, status });
  }

  /**
   * 콘텐츠 검색 (페이지네이션, 필터링, 정렬)
   */
  async searchContents(query: {
    page?: number;
    limit?: LimitType;
    creatorId?: string;
    platform?: PlatformType;
    type?: ContentType;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{
    items: ContentWithCreatorDto[];
    pageInfo: {
      totalItems: number;
      page: number;
      limit: LimitType;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }> {
    // 1. Repository에서 Content 조회
    const { items, pageInfo } = await this.contentRepository.searchContents(query);

    // 2. 모든 creatorId 추출 (중복 제거)
    const creatorIds = [...new Set(items.map((item) => item.creatorId))];

    // 3. 일괄적으로 User 정보 조회 (TCP 통신)
    const userMap = await this.fetchUsersForCreators(creatorIds);

    // 4. Creator 정보 조회
    const creatorMap = new Map<string, CreatorEntity>();
    await Promise.all(
      creatorIds.map(async (id) => {
        const creator = await this.creatorService.findById(id);
        if (creator) {
          creatorMap.set(id, creator);
        }
      })
    );

    // 5. Content + Creator + User 매핑
    const enrichedItems: ContentWithCreatorDto[] = items.map((content) => {
      const creator = creatorMap.get(content.creatorId);
      const user = userMap.get(content.creatorId);

      const creatorInfo: CreatorInfo = {
        id: creator?.id || content.creatorId,
        name: creator?.name || 'Unknown',
      };
      if (creator?.profile?.displayName) {
        creatorInfo.displayName = creator.profile.displayName;
      }
      if (creator?.profileImageUrl) {
        creatorInfo.profileImageUrl = creator.profileImageUrl;
      }
      if (user) {
        creatorInfo.user = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        if (user.profileImage) {
          creatorInfo.user.profileImage = user.profileImage;
        }
      }

      return {
        id: content.id,
        type: content.type,
        title: content.title,
        description: content.description ?? '',
        thumbnail: content.thumbnail ?? '',
        url: content.url,
        platform: content.platform,
        platformId: content.platformId,
        duration: content.duration ?? 0,
        publishedAt: content.publishedAt.toISOString(),
        language: content.language ?? 'ko',
        isLive: content.isLive,
        quality: content.quality ?? 'sd',
        ageRestriction: content.ageRestriction,
        status: content.status,
        statistics: content.statistics!,
        syncInfo: content.syncInfo!,
        createdAt: content.createdAt.toISOString(),
        updatedAt: content.updatedAt.toISOString(),
        deletedAt: content.deletedAt ? content.deletedAt.toISOString() : null,
        creator: creatorInfo,
      };
    });

    this.logger.debug('Content search with creator info completed', {
      page: pageInfo.page,
      totalItems: pageInfo.totalItems,
      creatorsEnriched: userMap.size,
      filterCount: [query.creatorId, query.platform, query.type].filter(Boolean).length,
    });

    return {
      items: enrichedItems,
      pageInfo,
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * CreatorId로부터 User 정보를 가져옴 (auth-server TCP 통신)
   */
  private async fetchUserForCreator(creatorId: string): Promise<{
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  } | null> {
    try {
      // 1. Creator 조회하여 userId 획득
      const creator = await this.creatorService.findById(creatorId);
      if (!creator) {
        this.logger.warn('Creator not found for user fetch', { creatorId });
        return null;
      }

      // 2. auth-server에 TCP로 User 정보 요청
      const userResponse = await firstValueFrom(
        this.authClient.send<UserResponse>('user.find-by-id', creator.userId)
      );

      if (!userResponse) {
        this.logger.warn('User not found from auth-server', { userId: creator.userId });
        return null;
      }

      return userResponse?.profileImage
        ? {
            id: userResponse.id,
            name: userResponse.name,
            email: userResponse.email,
            profileImage: userResponse.profileImage,
          }
        : {
            id: userResponse.id,
            name: userResponse.name,
            email: userResponse.email,
          };
    } catch (error) {
      this.logger.error('Failed to fetch user for creator', { creatorId, error });
      return null;
    }
  }

  /**
   * 여러 CreatorId에 대해 일괄 User 정보 조회
   */
  private async fetchUsersForCreators(creatorIds: string[]): Promise<
    Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        profileImage?: string;
      }
    >
  > {
    const userMap = new Map();

    if (creatorIds.length === 0) {
      return userMap;
    }

    try {
      // 1. 모든 Creator 조회
      const creators = await Promise.all(creatorIds.map((id) => this.creatorService.findById(id)));

      // 2. userId 목록 추출
      const userIds = creators.filter((c) => c !== null).map((c) => c!.userId);

      if (userIds.length === 0) {
        return userMap;
      }

      // 3. auth-server에 일괄 요청
      const usersResponse = await firstValueFrom(
        this.authClient.send<UserResponse[]>('user.find-by-ids', userIds)
      );

      if (!usersResponse || !Array.isArray(usersResponse)) {
        this.logger.warn('Invalid response from auth-server for bulk user fetch');
        return userMap;
      }

      // 4. creatorId → user 매핑
      creators.forEach((creator, index) => {
        if (creator) {
          const user = usersResponse.find((u: UserResponse) => u.id === creator.userId);
          if (user) {
            userMap.set(creatorIds[index], {
              id: user.id,
              name: user.name,
              email: user.email,
              profileImage: user.profileImage,
            });
          }
        }
      });

      this.logger.debug('Bulk user fetch completed', {
        requestedCreators: creatorIds.length,
        fetchedUsers: userMap.size,
      });

      return userMap;
    } catch (error) {
      this.logger.error('Failed to fetch users for creators', { error });
      return userMap;
    }
  }
}
