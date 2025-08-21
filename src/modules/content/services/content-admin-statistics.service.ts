import { Injectable, Logger } from '@nestjs/common';

import { LessThan, MoreThan, FindManyOptions } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import { ContentRepository } from '../repositories/index.js';
import { ContentEntity } from '../entities/index.js';
import { ContentException } from '../exceptions/index.js';

import { ContentStatisticsService } from './content-statistics.service.js';
import { ReportService } from '../../report/services/report.service.js';
import { ReportTargetType } from '../../report/enums/index.js';

@Injectable()
export class ContentAdminStatisticsService {
  private readonly logger = new Logger(ContentAdminStatisticsService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly contentStatisticsService: ContentStatisticsService,
    private readonly reportService: ReportService
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 통계 메서드들
  async getTotalCount(): Promise<number> {
    try {
      return await this.contentRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.error('Failed to get total content count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async getContentCountByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.contentRepo.count({
        where: { creatorId },
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get content count by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getTotalViewsByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.contentStatisticsService.getTotalViewsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get total views by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  // ==================== 시간대별 통계 메서드 ====================

  async getNewContentCounts(days: number): Promise<{
    dailyNewContent: number;
    weeklyNewContent: number;
    monthlyNewContent: number;
  }> {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000));
      const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      const monthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const [dailyNewContent, weeklyNewContent, monthlyNewContent] = await Promise.all([
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(dayAgo),
          },
        }),
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(weekAgo),
          },
        }),
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(monthAgo),
          },
        }),
      ]);

      return {
        dailyNewContent,
        weeklyNewContent,
        monthlyNewContent,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get new content counts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      return {
        dailyNewContent: 0,
        weeklyNewContent: 0,
        monthlyNewContent: 0,
      };
    }
  }

  async getTopContentByViews(limit: number = 10): Promise<Array<{
    contentId: string;
    title: string;
    views: number;
    creatorName: string;
  }>> {
    try {
      const results = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('content_statistics', 'stats', 'content.id = stats.contentId')
        .leftJoin('creators', 'creator', 'content.creatorId = creator.id')
        .select([
          'content.id as contentId',
          'content.title as title',
          'stats.views as views',
          'COALESCE(creator.displayName, creator.name) as creatorName',
        ])
        .orderBy('stats.views', 'DESC')
        .limit(limit)
        .getRawMany();

      return results.map(result => ({
        contentId: result.contentId,
        title: result.title,
        views: parseInt(result.views) || 0,
        creatorName: result.creatorName || `Creator ${result.contentId}`,
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get top content by views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  async getPlatformDistribution(): Promise<Array<{
    platform: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      const totalContent = await this.contentRepo.count();
      
      if (totalContent === 0) {
        return [];
      }

      const results = await this.contentRepo
        .createQueryBuilder('content')
        .select('content.platform', 'platform')
        .addSelect('COUNT(*)', 'contentCount')
        .groupBy('content.platform')
        .getRawMany();

      return results.map(result => ({
        platform: result.platform,
        contentCount: parseInt(result.contentCount),
        percentage: Math.round((parseInt(result.contentCount) / totalContent) * 100),
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get platform distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async getCategoryDistribution(): Promise<Array<{
    category: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      const totalContent = await this.contentRepo.count();
      
      if (totalContent === 0) {
        return [];
      }

      // ContentCategory 엔티티를 통해 카테고리 분포 조회
      const results = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('content_categories', 'cc', 'content.id = cc.contentId')
        .leftJoin('categories', 'cat', 'cc.categoryId = cat.id')
        .select('cat.name', 'category')
        .addSelect('COUNT(*)', 'contentCount')
        .where('cat.name IS NOT NULL')
        .groupBy('cat.name')
        .getRawMany();

      return results.map(result => ({
        category: result.category,
        contentCount: parseInt(result.contentCount),
        percentage: Math.round((parseInt(result.contentCount) / totalContent) * 100),
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // ==================== 전체 콘텐츠 통계 ====================

  async getContentStatistics(): Promise<{
    totalContent: number;
    contentByPlatform: Array<{ platform: string; count: number }>;
    contentByType: Array<{ type: string; count: number }>;
    liveContent: number;
    ageRestrictedContent: number;
  }> {
    try {
      const [
        totalContent,
        liveContent,
        ageRestrictedContent,
        contentByPlatform,
        contentByType,
      ] = await Promise.all([
        this.contentRepo.count(),
        this.contentRepo.count({ where: { isLive: true } }),
        this.contentRepo.count({ where: { ageRestriction: true } }),
        this.contentRepo.getPlatformDistribution(),
        this.contentRepo.createQueryBuilder('content')
          .select('content.type', 'type')
          .addSelect('COUNT(*)', 'count')
          .groupBy('content.type')
          .getRawMany(),
      ]);

      this.logger.debug('Content statistics calculated', {
        totalContent,
        liveContent,
        ageRestrictedContent,
        platformCount: contentByPlatform.length,
        typeCount: contentByType.length,
      });

      return {
        totalContent,
        contentByPlatform,
        contentByType: contentByType.map(item => ({
          type: item.type,
          count: parseInt(item.count),
        })),
        liveContent,
        ageRestrictedContent,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get content statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getRecentContentByPlatform(
    limit?: number,
    platform?: string
  ): Promise<ContentEntity[]> {
    try {
      const queryOptions: FindManyOptions<ContentEntity> = {
        order: { publishedAt: 'DESC' },
      };

      if (platform) {
        queryOptions.where = { platform: platform as PlatformType };
      }

      if (limit) {
        queryOptions.take = limit;
      }

      return await this.contentRepo.find(queryOptions);
    } catch (error: unknown) {
      this.logger.error('Failed to get recent content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 데이터 분석 통계 ====================

  async getCreatorContentStats(creatorId: string): Promise<{
    total: number;
    within30Days: number;
    older30Days: number;
    platformBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const contents = await this.contentRepo.find({
        where: { creatorId },
        select: ['id', 'platform', 'type', 'publishedAt']
      });
      
      const stats = {
        total: contents.length,
        within30Days: contents.filter(c => c.publishedAt > thirtyDaysAgo).length,
        older30Days: contents.filter(c => c.publishedAt <= thirtyDaysAgo).length,
        platformBreakdown: {} as Record<string, number>,
        typeBreakdown: {} as Record<string, number>
      };
      
      // 플랫폼별 통계
      contents.forEach(content => {
        if (content.platform) {
          stats.platformBreakdown[content.platform] = (stats.platformBreakdown[content.platform] || 0) + 1;
        }
        if (content.type) {
          stats.typeBreakdown[content.type] = (stats.typeBreakdown[content.type] || 0) + 1;
        }
      });
      
      this.logger.debug('Creator content stats calculated', {
        creatorId,
        ...stats
      });
      
      return stats;
    } catch (error: unknown) {
      this.logger.error('Failed to get creator content stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentAgeStats(): Promise<{
    totalOld: number; // 30일 이상된 콘텐츠
    totalRecent: number; // 30일 이내 콘텐츠
    platformBreakdown: Record<string, { old: number; recent: number }>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const [oldContents, recentContents] = await Promise.all([
        this.contentRepo.find({
          where: { publishedAt: LessThan(thirtyDaysAgo) },
          select: ['id', 'platform']
        }),
        this.contentRepo.find({
          where: { publishedAt: MoreThan(thirtyDaysAgo) },
          select: ['id', 'platform']
        })
      ]);

      const platformBreakdown: Record<string, { old: number; recent: number }> = {};

      oldContents.forEach(content => {
        if (content.platform) {
          if (!platformBreakdown[content.platform]) {
            platformBreakdown[content.platform] = { old: 0, recent: 0 };
          }
          platformBreakdown[content.platform]!.old++;
        }
      });

      recentContents.forEach(content => {
        if (content.platform) {
          if (!platformBreakdown[content.platform]) {
            platformBreakdown[content.platform] = { old: 0, recent: 0 };
          }
          platformBreakdown[content.platform]!.recent++;
        }
      });

      return {
        totalOld: oldContents.length,
        totalRecent: recentContents.length,
        platformBreakdown
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get content age stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 크리에이터의 오래된 콘텐츠 상태 검사
   * 지정된 기간 이상 된 데이터가 있는지 확인
   */
  async checkOldContentStatus(creatorId: string, daysOld: number = 30): Promise<{
    needsCleanup: boolean;
    oldDataCount: number;
    oldestDataDate: Date | null;
    recentDataCount: number;
  }> {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
      
      const [oldData, recentData] = await Promise.all([
        this.contentRepo.find({
          where: {
            creatorId,
            publishedAt: LessThan(cutoffDate)
          },
          order: { publishedAt: 'ASC' },
          select: ['id', 'publishedAt']
        }),
        this.contentRepo.find({
          where: {
            creatorId,
            publishedAt: MoreThan(cutoffDate)
          },
          select: ['id']
        })
      ]);
      
      const needsCleanup = oldData.length > 0;
      const oldestDataDate = oldData.length > 0 ? (oldData[0]?.publishedAt || null) : null;
      
      this.logger.debug('Old content status checked', {
        creatorId,
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length,
        cutoffDate,
        daysOld
      });
      
      return {
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length
      };
    } catch (error: unknown) {
      this.logger.error('Failed to check rolling window status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 신고 관련 통계 (선택적) ====================

  async getContentReportCount(contentId: string): Promise<number> {
    try {
      // 콘텐츠 존재 확인
      const content = await this.contentRepo.findOneById(contentId);
      if (!content) {
        throw ContentException.contentNotFound();
      }

      // ReportService를 통해 실제 신고 수 조회
      const reportCount = await this.reportService.getCountByTarget(
        ReportTargetType.CONTENT, 
        contentId
      );
      
      return reportCount;
    } catch (error: unknown) {
      this.logger.error('Failed to get content report count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return 0;
    }
  }

  async getContentReports(contentId: string): Promise<Array<{
    id: string;
    reportedBy: string;
    reason: string;
    status: string;
    reportedAt: Date;
    reviewedAt?: Date;
    reviewComment?: string;
  }>> {
    try {
      // 콘텐츠 존재 확인
      const content = await this.contentRepo.findOneById(contentId);
      if (!content) {
        throw ContentException.contentNotFound();
      }

      // ReportService는 circular dependency를 피하기 위해 직접 주입하지 않음
      // AdminContentController에서 직접 ReportService를 사용하도록 구조 변경
      
      this.logger.debug('Content reports request', { contentId });
      return [];
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }

      this.logger.error('Failed to get content reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentFetchError();
    }
  }
}