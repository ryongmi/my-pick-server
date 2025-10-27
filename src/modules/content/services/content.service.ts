import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';

import { PlatformType } from '@common/enums/index.js';

import { ContentException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { ContentRepository } from '../repositories/content.repository.js';
import { ContentEntity, ContentStatistics, ContentSyncInfo } from '../entities/content.entity.js';
import { ContentType } from '../enums/index.js';

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

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepository: ContentRepository,
    // 순환 참조 방지를 위해 Inject + forwardRef 사용
    @Inject(forwardRef(() => CreatorService))
    private readonly creatorService: CreatorService
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
  async findWithCreator(contentId: string): Promise<{
    content: ContentEntity;
    creator: { id: string; name: string; profileImageUrl?: string };
  } | null> {
    return this.contentRepository.findWithCreator(contentId);
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
}
