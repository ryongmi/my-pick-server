import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType } from '@krgeobuk/core/enum';

import { CreatorEntity } from '../entities/creator.entity.js';
import { CreatorSearchQueryDto } from '../dto/search-query.dto.js';

@Injectable()
export class CreatorRepository extends BaseRepository<CreatorEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorEntity, dataSource);
  }

  async findByName(name: string): Promise<CreatorEntity | null> {
    return this.findOne({
      where: { name, isActive: true },
    });
  }

  async findActive(): Promise<CreatorEntity[]> {
    return this.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 크리에이터 검색 (페이지네이션)
   */
  async searchCreators(
    query: CreatorSearchQueryDto,
    userId?: string
  ): Promise<{
    items: CreatorEntity[];
    pageInfo: {
      totalItems: number;
      page: number;
      limit: LimitType;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }> {
    const { page = 1, limit = LimitType.THIRTY, name, activeOnly, platform, orderBy } = query;

    const queryBuilder = this.createQueryBuilder('creator').where('1=1');

    if (userId) {
      queryBuilder.andWhere('creator.userId != :userId', {
        userId,
      });
    }

    // 이름 검색
    if (name) {
      queryBuilder.andWhere('creator.name LIKE :name', {
        name: `%${name}%`,
      });
    }

    // 활성화 필터
    if (activeOnly) {
      queryBuilder.andWhere('creator.isActive = :isActive', { isActive: true });
    }

    // 플랫폼 필터 (JOIN + DISTINCT)
    if (platform) {
      queryBuilder
        .innerJoin(
          'creator_platforms',
          'cp',
          'cp.creatorId = creator.id AND cp.platformType = :platformType AND cp.isActive = true',
          { platformType: platform }
        )
        .distinct(true);
    }

    // 정렬 옵션
    switch (orderBy) {
      case 'followers':
        // JSON 필드: statistics->totalSubscribers 기준 내림차순
        // MySQL에서는 IFNULL로 NULL을 0으로 처리
        // TypeORM 이슈: 복잡한 SQL 표현식은 addSelect로 별칭 생성 후 정렬
        queryBuilder
          .addSelect(
            'IFNULL(JSON_EXTRACT(creator.statistics, "$.totalSubscribers"), 0)',
            'follower_count'
          )
          .orderBy('follower_count', 'DESC');
        break;
      case 'name':
        // 이름 오름차순
        queryBuilder.orderBy('creator.name', 'ASC');
        break;
      case 'content':
        // JSON 필드: statistics->totalVideos 기준 내림차순
        // TypeORM 이슈: 복잡한 SQL 표현식은 addSelect로 별칭 생성 후 정렬
        queryBuilder
          .addSelect('IFNULL(JSON_EXTRACT(creator.statistics, "$.totalVideos"), 0)', 'video_count')
          .orderBy('video_count', 'DESC');
        break;
      case 'recent':
      default:
        // 최신 순 (기본값)
        queryBuilder.orderBy('creator.createdAt', 'DESC');
        break;
    }

    // 전체 개수 조회
    const total = await queryBuilder.getCount();
    console.log(queryBuilder.getSql());
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
