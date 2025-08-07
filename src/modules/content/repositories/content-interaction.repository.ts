import { Injectable } from '@nestjs/common';
import { DataSource, Repository, MoreThan, Between } from 'typeorm';

import { ContentInteractionEntity } from '../entities/index.js';

export interface InteractionStats {
  totalInteractions: number;
  uniqueUsers: number;
  avgWatchPercentage: number;
  avgRating: number;
}

export interface UserEngagement {
  userId: string;
  interactionCount: number;
  avgWatchPercentage: number;
  lastInteractionAt: Date;
}

export interface ContentPerformance {
  contentId: string;
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  shareCount: number;
  commentCount: number;
  avgWatchPercentage: number;
  avgRating: number;
}

@Injectable()
export class ContentInteractionRepository extends Repository<ContentInteractionEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentInteractionEntity, dataSource.createEntityManager());
  }

  // ==================== 기본 조회 메서드 ====================

  async findByContentId(contentId: string): Promise<ContentInteractionEntity[]> {
    return await this.find({
      where: { contentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findInteraction(contentId: string, userId: string): Promise<ContentInteractionEntity | null> {
    return await this.findOne({
      where: { contentId, userId },
    });
  }

  // ==================== 사용자 상호작용 메서드 ====================

  async getUserBookmarks(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.find({
      where: {
        userId,
        isBookmarked: true,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async getUserLikes(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.find({
      where: {
        userId,
        isLiked: true,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async getUserWatchHistory(userId: string, limit = 50): Promise<ContentInteractionEntity[]> {
    return await this.find({
      where: {
        userId,
        watchedAt: MoreThan(new Date(0)), // watchedAt이 null이 아닌 경우
      },
      order: { watchedAt: 'DESC' },
      take: limit,
    });
  }

  // ==================== 콘텐츠 성과 분석 메서드 ====================

  async getContentPerformance(contentId: string): Promise<ContentPerformance | null> {
    const result = await this.createQueryBuilder('ci')
      .select('ci.contentId', 'contentId')
      .addSelect('COUNT(CASE WHEN ci.interactionType = "view" THEN 1 END)', 'viewCount')
      .addSelect('COUNT(CASE WHEN ci.isLiked = true THEN 1 END)', 'likeCount')
      .addSelect('COUNT(CASE WHEN ci.isBookmarked = true THEN 1 END)', 'bookmarkCount')
      .addSelect('COUNT(CASE WHEN ci.isShared = true THEN 1 END)', 'shareCount')
      .addSelect('COUNT(CASE WHEN ci.comment IS NOT NULL THEN 1 END)', 'commentCount')
      .addSelect('AVG(ci.watchPercentage)', 'avgWatchPercentage')
      .addSelect('AVG(ci.rating)', 'avgRating')
      .where('ci.contentId = :contentId', { contentId })
      .groupBy('ci.contentId')
      .getRawOne();

    if (!result) return null;

    return {
      contentId: result.contentId,
      viewCount: parseInt(result.viewCount) || 0,
      likeCount: parseInt(result.likeCount) || 0,
      bookmarkCount: parseInt(result.bookmarkCount) || 0,
      shareCount: parseInt(result.shareCount) || 0,
      commentCount: parseInt(result.commentCount) || 0,
      avgWatchPercentage: parseFloat(result.avgWatchPercentage) || 0,
      avgRating: parseFloat(result.avgRating) || 0,
    };
  }

  async getTopPerformingContent(limit = 20): Promise<ContentPerformance[]> {
    const results = await this.createQueryBuilder('ci')
      .select('ci.contentId', 'contentId')
      .addSelect('COUNT(CASE WHEN ci.interactionType = "view" THEN 1 END)', 'viewCount')
      .addSelect('COUNT(CASE WHEN ci.isLiked = true THEN 1 END)', 'likeCount')
      .addSelect('COUNT(CASE WHEN ci.isBookmarked = true THEN 1 END)', 'bookmarkCount')
      .addSelect('COUNT(CASE WHEN ci.isShared = true THEN 1 END)', 'shareCount')
      .addSelect('COUNT(CASE WHEN ci.comment IS NOT NULL THEN 1 END)', 'commentCount')
      .addSelect('AVG(ci.watchPercentage)', 'avgWatchPercentage')
      .addSelect('AVG(ci.rating)', 'avgRating')
      .groupBy('ci.contentId')
      .orderBy('viewCount', 'DESC')
      .addOrderBy('likeCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(result => ({
      contentId: result.contentId,
      viewCount: parseInt(result.viewCount) || 0,
      likeCount: parseInt(result.likeCount) || 0,
      bookmarkCount: parseInt(result.bookmarkCount) || 0,
      shareCount: parseInt(result.shareCount) || 0,
      commentCount: parseInt(result.commentCount) || 0,
      avgWatchPercentage: parseFloat(result.avgWatchPercentage) || 0,
      avgRating: parseFloat(result.avgRating) || 0,
    }));
  }

  // ==================== 사용자 참여도 분석 메서드 ====================

  async getUserEngagement(userId: string): Promise<UserEngagement | null> {
    const result = await this.createQueryBuilder('ci')
      .select('ci.userId', 'userId')
      .addSelect('COUNT(*)', 'interactionCount')
      .addSelect('AVG(ci.watchPercentage)', 'avgWatchPercentage')
      .addSelect('MAX(ci.updatedAt)', 'lastInteractionAt')
      .where('ci.userId = :userId', { userId })
      .groupBy('ci.userId')
      .getRawOne();

    if (!result) return null;

    return {
      userId: result.userId,
      interactionCount: parseInt(result.interactionCount),
      avgWatchPercentage: parseFloat(result.avgWatchPercentage) || 0,
      lastInteractionAt: new Date(result.lastInteractionAt),
    };
  }

  async getMostEngagedUsers(limit = 50): Promise<UserEngagement[]> {
    const results = await this.createQueryBuilder('ci')
      .select('ci.userId', 'userId')
      .addSelect('COUNT(*)', 'interactionCount')
      .addSelect('AVG(ci.watchPercentage)', 'avgWatchPercentage')
      .addSelect('MAX(ci.updatedAt)', 'lastInteractionAt')
      .groupBy('ci.userId')
      .orderBy('interactionCount', 'DESC')
      .addOrderBy('avgWatchPercentage', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(result => ({
      userId: result.userId,
      interactionCount: parseInt(result.interactionCount),
      avgWatchPercentage: parseFloat(result.avgWatchPercentage) || 0,
      lastInteractionAt: new Date(result.lastInteractionAt),
    }));
  }

  // ==================== 통계 및 집계 메서드 ====================

  async getOverallStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<InteractionStats> {
    let whereCondition = {};
    
    if (startDate && endDate) {
      whereCondition = {
        createdAt: Between(startDate, endDate),
      };
    } else if (startDate) {
      whereCondition = {
        createdAt: MoreThan(startDate),
      };
    }

    const result = await this.createQueryBuilder('ci')
      .select('COUNT(*)', 'totalInteractions')
      .addSelect('COUNT(DISTINCT ci.userId)', 'uniqueUsers')
      .addSelect('AVG(ci.watchPercentage)', 'avgWatchPercentage')
      .addSelect('AVG(ci.rating)', 'avgRating')
      .where(whereCondition)
      .getRawOne();

    return {
      totalInteractions: parseInt(result.totalInteractions) || 0,
      uniqueUsers: parseInt(result.uniqueUsers) || 0,
      avgWatchPercentage: parseFloat(result.avgWatchPercentage) || 0,
      avgRating: parseFloat(result.avgRating) || 0,
    };
  }

  async getInteractionsByDevice(contentId?: string): Promise<Array<{ deviceType: string; count: number }>> {
    const queryBuilder = this.createQueryBuilder('ci')
      .select('ci.deviceType', 'deviceType')
      .addSelect('COUNT(*)', 'count')
      .where('ci.deviceType IS NOT NULL');

    if (contentId) {
      queryBuilder.andWhere('ci.contentId = :contentId', { contentId });
    }

    return await queryBuilder
      .groupBy('ci.deviceType')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  // ==================== 배치 처리 메서드 ====================

  async upsertInteraction(interaction: Partial<ContentInteractionEntity>): Promise<void> {
    await this.createQueryBuilder()
      .insert()
      .into(ContentInteractionEntity)
      .values(interaction)
      .orUpdate(['interactionType', 'isBookmarked', 'isLiked', 'isShared', 'watchedAt', 'watchDuration', 'watchPercentage', 'rating', 'comment', 'deviceType', 'referrer', 'updatedAt'])
      .execute();
  }

  async batchUpdateInteractions(
    updates: Array<Partial<ContentInteractionEntity> & { contentId: string; userId: string }>
  ): Promise<void> {
    if (updates.length === 0) return;

    for (const update of updates) {
      await this.upsertInteraction(update);
    }
  }

  async cleanupOldInteractions(daysToKeep = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.createQueryBuilder()
      .delete()
      .from(ContentInteractionEntity)
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('isBookmarked = false')
      .andWhere('isLiked = false')
      .execute();

    return result.affected || 0;
  }
}