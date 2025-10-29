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
  async searchCreators(query: CreatorSearchQueryDto): Promise<{
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
    const { page = 1, limit = LimitType.THIRTY, keyword, activeOnly, userId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.createQueryBuilder('creator').where('1=1');

    // 키워드 검색 (이름)
    if (keyword) {
      queryBuilder.andWhere('creator.name LIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    // 활성화 필터
    if (activeOnly) {
      queryBuilder.andWhere('creator.isActive = :isActive', { isActive: true });
    }

    // 사용자 필터
    if (userId) {
      queryBuilder.andWhere('creator.userId = :userId', { userId });
    }

    // 정렬: 최신 순
    queryBuilder.orderBy('creator.createdAt', 'DESC');

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
