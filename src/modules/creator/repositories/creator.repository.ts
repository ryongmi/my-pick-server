import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType, SortByBaseType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorEntity } from '../entities/index.js';

export interface CreatorSearchQuery {
  name?: string;
  category?: string;
  isVerified?: boolean;
  tags?: string[];
  page?: number;
  limit?: LimitType;
  sortOrder?: SortOrderType;
  sortBy?: 'name' | 'followerCount' | 'createdAt';
}

@Injectable()
export class CreatorRepository extends BaseRepository<CreatorEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorEntity, dataSource);
  }

  async searchCreators(
    query: CreatorSearchQuery
  ): Promise<PaginatedResult<Partial<CreatorEntity>>> {
    const {
      name,
      category,
      isVerified,
      tags,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortOrder = SortOrderType.DESC,
      sortBy = SortByBaseType.CREATED_AT,
    } = query;

    const skip = (page - 1) * limit;
    const creatorAlias = 'creator';

    const queryBuilder = this.createQueryBuilder(creatorAlias).select([
      `${creatorAlias}.id AS id`,
      `${creatorAlias}.name AS name`,
      `${creatorAlias}.display_name AS displayName`,
      `${creatorAlias}.avatar AS avatar`,
      `${creatorAlias}.description AS description`,
      `${creatorAlias}.is_verified AS isVerified`,
      `${creatorAlias}.category AS category`,
      `${creatorAlias}.tags AS tags`,
      `${creatorAlias}.created_at AS createdAt`,
    ]);

    if (name) {
      queryBuilder.andWhere(
        `(${creatorAlias}.name ILIKE :name OR ${creatorAlias}.display_name ILIKE :displayName)`,
        { name: `%${name}%`, displayName: `%${name}%` }
      );
    }

    if (category) {
      queryBuilder.andWhere(`${creatorAlias}.category = :category`, { category });
    }

    if (typeof isVerified === 'boolean') {
      queryBuilder.andWhere(`${creatorAlias}.is_verified = :isVerified`, {
        isVerified,
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere(`${creatorAlias}.tags && :tags`, { tags });
    }

    queryBuilder.orderBy(`${creatorAlias}.${sortBy}`, sortOrder);

    queryBuilder.offset(skip).limit(limit);

    const [items, total] = await Promise.all([queryBuilder.getRawMany(), queryBuilder.getCount()]);

    const totalPages = Math.ceil(total / limit);
    const pageInfo = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return { items, pageInfo };
  }

  async getTotalCount(): Promise<number> {
    return this.count();
  }
}

