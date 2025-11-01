import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';

import { PlatformType } from '@common/enums/index.js';

import { ContentEntity } from '../entities/content.entity.js';

@Injectable()
export class ContentRepository extends BaseRepository<ContentEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentEntity, dataSource);
  }

  /**
   * 플랫폼 타입과 플랫폼 ID로 콘텐츠 조회
   */
  async findByPlatformAndId(
    platform: PlatformType,
    platformId: string
  ): Promise<ContentEntity | null> {
    return this.findOne({
      where: { platform, platformId },
    });
  }

  /**
   * 크리에이터의 콘텐츠 목록 조회 (페이지네이션)
   */
  async findByCreatorId(
    creatorId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<ContentEntity[]> {
    const query = this.createQueryBuilder('content')
      .where('content.creatorId = :creatorId', { creatorId })
      .andWhere('content.status = :status', { status: 'active' })
      .orderBy('content.publishedAt', 'DESC');

    if (options?.limit) {
      query.take(options.limit);
    }

    if (options?.offset) {
      query.skip(options.offset);
    }

    return query.getMany();
  }

  /**
   * 특정 날짜 이후의 콘텐츠 조회 (증분 동기화용)
   */
  async findByCreatorIdAfterDate(creatorId: string, afterDate: Date): Promise<ContentEntity[]> {
    return this.find({
      where: {
        creatorId,
        publishedAt: afterDate as any, // TypeORM MoreThan을 사용해야 하지만 간단히 처리
      },
      order: {
        publishedAt: 'DESC',
      },
    });
  }

  /**
   * 크리에이터와 플랫폼 정보를 포함한 콘텐츠 조회
   */
  async findWithCreator(contentId: string): Promise<{
    content: ContentEntity;
    creator: { id: string; name: string; profileImageUrl?: string };
  } | null> {
    const result = await this.createQueryBuilder('content')
      .select([
        'content.id',
        'content.type',
        'content.title',
        'content.description',
        'content.thumbnail',
        'content.url',
        'content.platform',
        'content.platformId',
        'content.duration',
        'content.publishedAt',
        'content.creatorId',
        'content.language',
        'content.isLive',
        'content.quality',
        'content.ageRestriction',
        'content.status',
        'content.statistics',
        'content.syncInfo',
        'creator.id',
        'creator.name',
        'creator.profileImageUrl',
      ])
      .innerJoin('creators', 'creator', 'creator.id = content.creatorId')
      .where('content.id = :contentId', { contentId })
      .getRawOne();

    if (!result) return null;

    return {
      content: {
        id: result.content_id,
        type: result.content_type,
        title: result.content_title,
        description: result.content_description,
        thumbnail: result.content_thumbnail,
        url: result.content_url,
        platform: result.content_platform,
        platformId: result.content_platformId,
        duration: result.content_duration,
        publishedAt: result.content_publishedAt,
        creatorId: result.content_creatorId,
        language: result.content_language,
        isLive: result.content_isLive,
        quality: result.content_quality,
        ageRestriction: result.content_ageRestriction,
        status: result.content_status,
        statistics: result.content_statistics,
        syncInfo: result.content_syncInfo,
      } as ContentEntity,
      creator: {
        id: result.creator_id,
        name: result.creator_name,
        profileImageUrl: result.creator_profileImageUrl,
      },
    };
  }

  /**
   * 배치 저장 (YouTube 동기화용)
   */
  async saveBatch(contents: Partial<ContentEntity>[]): Promise<ContentEntity[]> {
    return this.save(contents);
  }

  /**
   * 통계 정보 업데이트
   */
  async updateStatistics(
    id: string,
    statistics: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    }
  ): Promise<void> {
    await this.update(id, {
      statistics: {
        ...statistics,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * 동기화 정보 업데이트
   */
  async updateSyncInfo(id: string, syncInfo: Partial<ContentEntity['syncInfo']>): Promise<void> {
    const content = await this.findOne({ where: { id } });
    if (!content) return;

    await this.update(id, {
      syncInfo: {
        ...content.syncInfo,
        ...syncInfo,
      },
    });
  }

  /**
   * 콘텐츠 검색 (페이지네이션, 필터링, 정렬)
   */
  async searchContents(options: {
    page?: number;
    limit?: LimitType;
    creatorId?: string;
    platform?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: SortOrderType;
  }): Promise<{
    items: ContentEntity[];
    pageInfo: {
      totalItems: number;
      page: number;
      limit: LimitType;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }> {
    const {
      page = 1,
      limit = LimitType.THIRTY,
      creatorId,
      platform,
      type,
      sortBy = 'publishedAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const queryBuilder = this.createQueryBuilder('content').where('content.status = :status', {
      status: 'active',
    });

    // 필터링
    if (creatorId) {
      queryBuilder.andWhere('content.creatorId = :creatorId', { creatorId });
    }
    if (platform) {
      queryBuilder.andWhere('content.platform = :platform', { platform });
    }
    if (type) {
      queryBuilder.andWhere('content.type = :type', { type });
    }

    // 정렬 (JSON 필드 접근 처리)
    if (sortBy === 'views' || sortBy === 'likes') {
      queryBuilder
        .addSelect(`IFNULL(JSON_EXTRACT(content.statistics, '$.${sortBy}'), 0)`, 'sort_count')
        .orderBy('sort_count', sortOrder);
      // queryBuilder.orderBy(`JSON_EXTRACT(content.statistics, '$.${sortBy}')`, sortOrder);
    } else {
      queryBuilder.orderBy(`content.${sortBy}`, sortOrder);
    }

    // 전체 개수 조회
    const total = await queryBuilder.getCount();

    // 페이지네이션
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // 페이지네이션 메타 정보 계산
    const totalPages = Math.ceil(total / limit);
    const hasPreviousPage = page > 1;
    const hasNextPage = page < totalPages;

    return {
      items,
      pageInfo: {
        totalItems: total,
        page,
        limit,
        totalPages,
        hasPreviousPage,
        hasNextPage,
      },
    };
  }
}

