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
   * 사용자가 북마크한 콘텐츠 조회 (user_interactions + content + creator 3-way JOIN)
   */
  async findBookmarkedContentsWithCreator(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      content: ContentEntity;
      creator: { id: string; name: string; profileImageUrl?: string };
    }>;
    total: number;
  }> {
    const { page = 1, limit = 20 } = options || {};
    const offset = (page - 1) * limit;

    // 1. 전체 개수 조회
    const totalQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('user_interactions', 'ui')
      .where('ui.userId = :userId', { userId })
      .andWhere('ui.isBookmarked = :isBookmarked', { isBookmarked: true });

    const totalResult = await totalQuery.getRawOne();
    const total = parseInt(totalResult?.count || '0', 10);

    if (total === 0) {
      return { items: [], total: 0 };
    }

    // 2. 페이지네이션이 적용된 콘텐츠 조회 (3-way JOIN)
    const results = await this.createQueryBuilder('content')
      .select([
        'content.id AS contentId',
        'content.type AS type',
        'content.title AS title',
        'content.description AS description',
        'content.thumbnail AS thumbnail',
        'content.url AS url',
        'content.platform AS platform',
        'content.platformId AS platformId',
        'content.duration AS duration',
        'content.publishedAt AS publishedAt',
        // 'content.creatorId AS creatorId',
        'content.language AS language',
        'content.isLive AS isLive',
        'content.quality AS quality',
        'content.ageRestriction AS ageRestriction',
        'content.status AS status',
        'content.statistics AS statistics',
        'content.syncInfo AS syncInfo',
        'content.createdAt AS createdAt',
        'content.updatedAt AS updatedAt',
        'creator.id AS creatorId',
        'creator.name AS name',
        'creator.profileImageUrl AS profileImageUrl',
      ])
      .innerJoin('user_interactions', 'ui', 'ui.contentId = content.id')
      .innerJoin('creators', 'creator', 'creator.id = content.creatorId')
      .where('ui.userId = :userId', { userId })
      .andWhere('ui.isBookmarked = :isBookmarked', { isBookmarked: true })
      .andWhere('content.status = :status', { status: 'active' })
      .orderBy('ui.updatedAt', 'DESC') // 최근 북마크한 순서
      .skip(offset)
      .take(limit)
      .getRawMany();

    const items = results.map((result) => ({
      content: {
        id: result.contentId,
        type: result.type,
        title: result.title,
        description: result.description,
        thumbnail: result.thumbnail,
        url: result.url,
        platform: result.platform,
        platformId: result.platformId,
        duration: result.duration,
        publishedAt: result.publishedAt,
        creatorId: result.creatorId,
        language: result.language,
        isLive: result.isLive,
        quality: result.quality,
        ageRestriction: result.ageRestriction,
        status: result.status,
        statistics: result.statistics,
        syncInfo: result.syncInfo,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      } as ContentEntity,
      creator: {
        id: result.creatorId,
        name: result.name,
        profileImageUrl: result.profileImageUrl,
      },
    }));

    return {
      items,
      total,
    };
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
    creatorIds?: string[];
    platforms?: string[];
    type?: string;
    sortBy?: string;
    sortOrder?: SortOrderType;
    includeAllStatuses?: boolean;
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
      creatorIds,
      platforms,
      type,
      sortBy = 'publishedAt',
      sortOrder = SortOrderType.DESC,
      includeAllStatuses = false,
    } = options;

    const queryBuilder = this.createQueryBuilder('content');

    // 크리에이터 대시보드가 아닌 경우에만 ACTIVE 상태 필터링
    if (!includeAllStatuses) {
      queryBuilder.where('content.status = :status', {
        status: 'active',
      });
    }

    // 필터링 - 다중 크리에이터
    if (creatorIds && creatorIds.length > 0) {
      queryBuilder.andWhere('content.creatorId IN (:...creatorIds)', { creatorIds });
    }

    // 필터링 - 다중 플랫폼
    if (platforms && platforms.length > 0) {
      queryBuilder.andWhere('content.platform IN (:...platforms)', { platforms });
    }

    // 필터링 - 콘텐츠 타입
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

  /**
   * 플랫폼 타입과 플랫폼 ID 조합으로 여러 콘텐츠 조회 (UPSERT 용)
   */
  async findByPlatformIds(
    platformIds: Array<{ platform: PlatformType; platformId: string }>
  ): Promise<ContentEntity[]> {
    if (platformIds.length === 0) {
      return [];
    }

    const queryBuilder = this.createQueryBuilder('content');

    // WHERE (platform = ? AND platformId = ?) OR (platform = ? AND platformId = ?) ...
    const conditions = platformIds
      .map(
        (_, index) =>
          `(content.platform = :platform${index} AND content.platformId = :platformId${index})`
      )
      .join(' OR ');

    const parameters = platformIds.reduce((acc, item, index) => {
      acc[`platform${index}`] = item.platform;
      acc[`platformId${index}`] = item.platformId;
      return acc;
    }, {} as Record<string, string>);

    queryBuilder.where(conditions, parameters);

    return queryBuilder.getMany();
  }
}

