import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { BaseRepository } from '@krgeobuk/core/repositories';
import { UserInteractionEntity } from '../entities';

@Injectable()
export class UserInteractionRepository extends BaseRepository<UserInteractionEntity> {
  constructor(private dataSource: DataSource) {
    super(UserInteractionEntity, dataSource);
  }

  async findByUserId(userId: string): Promise<UserInteractionEntity[]> {
    return this.find({
      where: { userId },
      relations: ['content'],
    });
  }

  async findByContentId(contentId: string): Promise<UserInteractionEntity[]> {
    return this.find({
      where: { contentId },
    });
  }

  async findOne(userId: string, contentId: string): Promise<UserInteractionEntity | null> {
    return super.findOne({
      where: { userId, contentId },
      relations: ['content'],
    });
  }

  async getBookmarkedContentIds(userId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('ui')
      .select('ui.contentId')
      .where('ui.userId = :userId AND ui.isBookmarked = :isBookmarked', { 
        userId, 
        isBookmarked: true 
      })
      .getRawMany();

    return result.map((row) => row.ui_contentId);
  }

  async getLikedContentIds(userId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('ui')
      .select('ui.contentId')
      .where('ui.userId = :userId AND ui.isLiked = :isLiked', { 
        userId, 
        isLiked: true 
      })
      .getRawMany();

    return result.map((row) => row.ui_contentId);
  }

  async getContentIds(userId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('ui')
      .select('ui.contentId')
      .where('ui.userId = :userId', { userId })
      .getRawMany();

    return result.map((row) => row.ui_contentId);
  }

  async getUserIds(contentId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('ui')
      .select('ui.userId')
      .where('ui.contentId = :contentId', { contentId })
      .getRawMany();

    return result.map((row) => row.ui_userId);
  }

  async getContentIdsBatch(userIds: string[]): Promise<Record<string, string[]>> {
    if (userIds.length === 0) return {};

    const result = await this.createQueryBuilder('ui')
      .select(['ui.userId', 'ui.contentId'])
      .where('ui.userId IN (:...userIds)', { userIds })
      .getRawMany();

    const userContentMap: Record<string, string[]> = {};
    userIds.forEach((userId) => {
      userContentMap[userId] = [];
    });

    result.forEach((row) => {
      const userId = row.ui_userId;
      const contentId = row.ui_contentId;
      if (userContentMap[userId]) {
        userContentMap[userId].push(contentId);
      }
    });

    return userContentMap;
  }

  // exists 메서드는 BaseRepository.exists() 사용

  async isBookmarked(userId: string, contentId: string): Promise<boolean> {
    const interaction = await super.findOne({
      where: { userId, contentId, isBookmarked: true },
    });
    return !!interaction;
  }

  async isLiked(userId: string, contentId: string): Promise<boolean> {
    const interaction = await super.findOne({
      where: { userId, contentId, isLiked: true },
    });
    return !!interaction;
  }

  async hasUsersForContent(contentId: string): Promise<boolean> {
    const count = await this.count({
      where: { contentId },
    });
    return count > 0;
  }

  // save 메서드는 BaseRepository.save() 또는 saveEntity() 사용

  // delete 메서드는 BaseRepository.delete() 사용

  async countBookmarksByContentId(contentId: string): Promise<number> {
    return this.count({
      where: { contentId, isBookmarked: true },
    });
  }

  async countLikesByContentId(contentId: string): Promise<number> {
    return this.count({
      where: { contentId, isLiked: true },
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.count({ where: { userId } });
  }

  async countBookmarksByUserId(userId: string): Promise<number> {
    return this.count({
      where: { userId, isBookmarked: true },
    });
  }

  async countLikesByUserId(userId: string): Promise<number> {
    return this.count({
      where: { userId, isLiked: true },
    });
  }

  async getWatchHistory(userId: string, limit: number = 50): Promise<UserInteractionEntity[]> {
    return this.find({
      where: { userId },
      relations: ['content'],
      order: { watchedAt: 'DESC' },
      take: limit,
    });
  }

  async getTopRatedContent(limit: number = 20): Promise<UserInteractionEntity[]> {
    return this.createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.content', 'content')
      .where('interaction.rating IS NOT NULL')
      .orderBy('interaction.rating', 'DESC')
      .addOrderBy('interaction.updatedAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}