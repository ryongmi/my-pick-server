import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { UserSubscriptionEntity } from '../entities/index.js';

/**
 * 중간테이블 Repository - 복잡한 쿼리만 포함
 * 단순 조회는 Service에서 BaseRepository 직접 사용
 */
@Injectable()
export class UserSubscriptionRepository extends BaseRepository<UserSubscriptionEntity> {
  constructor(private dataSource: DataSource) {
    super(UserSubscriptionEntity, dataSource);
  }

  /**
   * 사용자별 구독 크리에이터 ID 목록 조회 (최적화된 쿼리)
   */

  async getCreatorIds(userId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('us')
      .select('us.creatorId')
      .where('us.userId = :userId', { userId })
      .getRawMany();

    return result.map((row) => row.us_creatorId);
  }

  /**
   * 크리에이터별 구독 사용자 ID 목록 조회 (최적화된 쿼리)
   */

  async getUserIds(creatorId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('us')
      .select('us.userId')
      .where('us.creatorId = :creatorId', { creatorId })
      .getRawMany();

    return result.map((row) => row.us_userId);
  }

  /**
   * 여러 사용자의 구독 크리에이터 ID 목록 조회 (배치 처리)
   */

  async getCreatorIdsBatch(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const result = await this.createQueryBuilder('us')
      .select(['us.userId', 'us.creatorId'])
      .where('us.userId IN (:...userIds)', { userIds })
      .getRawMany();

    const userCreatorMap: Record<string, string[]> = {};
    userIds.forEach((userId) => {
      userCreatorMap[userId] = [];
    });

    result.forEach((row) => {
      const userId = row.us_userId;
      const creatorId = row.us_creatorId;
      if (userCreatorMap[userId]) {
        userCreatorMap[userId].push(creatorId);
      }
    });

    return userCreatorMap;
  }

  /**
   * 여러 크리에이터의 구독 사용자 ID 목록 조회 (배치 처리)
   */
  async getUserIdsBatch(creatorIds: string[]): Promise<Record<string, string[]>> {
    if (creatorIds.length === 0) return {};

    const result = await this.createQueryBuilder('us')
      .select(['us.creatorId', 'us.userId'])
      .where('us.creatorId IN (:...creatorIds)', { creatorIds })
      .getRawMany();

    const creatorUserMap: Record<string, string[]> = {};
    creatorIds.forEach((creatorId) => {
      creatorUserMap[creatorId] = [];
    });

    result.forEach((row) => {
      const creatorId = row.us_creatorId;
      const userId = row.us_userId;
      if (creatorUserMap[creatorId]) {
        creatorUserMap[creatorId].push(userId);
      }
    });

    return creatorUserMap;
  }

  // ==================== 단순 메서드들은 제거됨 ====================
  // findByUserId() → Service에서 find({ where: { userId } }) 직접 사용
  // findByCreatorId() → Service에서 find({ where: { creatorId } }) 직접 사용
  // findByUserAndCreator() → Service에서 findOne({ where: { userId, creatorId } }) 직접 사용
  // countByCreatorId() → Service에서 count({ where: { creatorId } }) 직접 사용
  // countByUserId() → Service에서 count({ where: { userId } }) 직접 사용
  // getTotalCount() → Service에서 count() 직접 사용
  // hasUsersForCreator() → Service에서 count({ where: { creatorId } }) > 0 직접 사용
  // exists() → BaseRepository.exists() 직접 사용
  // save() → BaseRepository.save() 직접 사용
  // delete() → BaseRepository.delete() 직접 사용
}
