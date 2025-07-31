import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { UserSubscriptionEntity } from '../entities/index.js';

@Injectable()
export class UserSubscriptionRepository extends BaseRepository<UserSubscriptionEntity> {
  constructor(private dataSource: DataSource) {
    super(UserSubscriptionEntity, dataSource);
  }

  async findByUserId(userId: string): Promise<UserSubscriptionEntity[]> {
    return this.find({
      where: { userId },
      relations: ['creator'],
    });
  }

  async findByCreatorId(creatorId: string): Promise<UserSubscriptionEntity[]> {
    return this.find({
      where: { creatorId },
    });
  }

  async findByUserAndCreator(userId: string, creatorId: string): Promise<UserSubscriptionEntity | null> {
    return this.findOne({
      where: { userId, creatorId },
      relations: ['creator'],
    });
  }

  async getCreatorIds(userId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('us')
      .select('us.creatorId')
      .where('us.userId = :userId', { userId })
      .getRawMany();

    return result.map((row) => row.us_creatorId);
  }

  async getUserIds(creatorId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('us')
      .select('us.userId')
      .where('us.creatorId = :creatorId', { creatorId })
      .getRawMany();

    return result.map((row) => row.us_userId);
  }

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

  // exists 메서드는 BaseRepository.exists() 사용

  async hasUsersForCreator(creatorId: string): Promise<boolean> {
    const count = await this.count({
      where: { creatorId },
    });
    return count > 0;
  }

  // save 메서드는 BaseRepository.save() 또는 saveEntity() 사용

  // delete 메서드는 BaseRepository.delete() 사용

  async countByCreatorId(creatorId: string): Promise<number> {
    return this.count({ where: { creatorId } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.count({ where: { userId } });
  }
}
