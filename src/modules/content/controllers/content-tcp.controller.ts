import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';

import { ContentService } from '../services';
import { UserInteractionService } from '../../user-interaction/services';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  ContentDetailDto,
  CreateContentDto,
  UpdateContentDto,
  UpdateContentStatisticsDto,
} from '../dto';
import {
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
} from '../../user-interaction/dto';

@Controller()
export class ContentTcpController {
  private readonly logger = new Logger(ContentTcpController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService,
  ) {}

  // ==================== 단일 도메인 조회 패턴 ====================

  @MessagePattern('content.findById')
  async findById(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP content detail request: ${data.contentId}`);
    return await this.contentService.findById(data.contentId);
  }

  @MessagePattern('content.findByIds')
  async findByIds(@Payload() data: { contentIds: string[] }) {
    this.logger.debug(`TCP content bulk fetch request`, {
      count: data.contentIds.length,
    });
    return await this.contentService.findByIds(data.contentIds);
  }

  @MessagePattern('content.findByCreatorId')
  async findByCreatorId(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP content by creator request: ${data.creatorId}`);
    return await this.contentService.findByCreatorId(data.creatorId);
  }

  @MessagePattern('content.findByCreatorIds')
  async findByCreatorIds(@Payload() data: { creatorIds: string[] }) {
    this.logger.debug(`TCP content by creators request`, {
      count: data.creatorIds.length,
    });
    return await this.contentService.findByCreatorIds(data.creatorIds);
  }

  @MessagePattern('content.search')
  async search(@Payload() data: { query: ContentSearchQueryDto; userId?: string }) {
    this.logger.debug('TCP content search request', {
      hasCreatorFilter: !!(data.query.creatorId || data.query.creatorIds),
      type: data.query.type,
      platform: data.query.platform,
      page: data.query.page,
    });
    return await this.contentService.searchContent(data.query, data.userId);
  }

  @MessagePattern('content.getDetail')
  async getDetail(@Payload() data: { contentId: string; userId?: string }) {
    this.logger.debug('TCP content detail request', {
      contentId: data.contentId,
      hasUserId: !!data.userId,
    });
    return await this.contentService.getContentById(data.contentId, data.userId);
  }

  @MessagePattern('content.getTrending')
  async getTrending(@Payload() data: { hours?: number; limit?: number }) {
    this.logger.debug('TCP trending content request', {
      hours: data.hours || 24,
      limit: data.limit || 50,
    });
    return await this.contentService.getTrendingContent(data.hours, data.limit);
  }

  @MessagePattern('content.getRecent')
  async getRecent(@Payload() data: { creatorIds: string[]; limit?: number }) {
    this.logger.debug('TCP recent content request', {
      creatorCount: data.creatorIds.length,
      limit: data.limit || 20,
    });
    return await this.contentService.getRecentContent(data.creatorIds, data.limit);
  }

  // ==================== 변경 작업 패턴 ====================

  @MessagePattern('content.create')
  async create(@Payload() dto: CreateContentDto) {
    this.logger.log('TCP content creation request', {
      type: dto.type,
      platform: dto.platform,
      platformId: dto.platformId,
      creatorId: dto.creatorId,
    });
    return await this.contentService.createContent(dto);
  }

  @MessagePattern('content.update')
  async update(@Payload() data: { contentId: string; updateData: UpdateContentDto }) {
    this.logger.log('TCP content update request', {
      contentId: data.contentId,
      updatedFields: Object.keys(data.updateData),
    });
    return await this.contentService.updateContent(data.contentId, data.updateData);
  }

  @MessagePattern('content.updateStatistics')
  async updateStatistics(
    @Payload() data: { contentId: string; statisticsData: UpdateContentStatisticsDto },
  ) {
    this.logger.log('TCP content statistics update request', {
      contentId: data.contentId,
      updatedFields: Object.keys(data.statisticsData),
    });
    return await this.contentService.updateContentStatistics(
      data.contentId,
      data.statisticsData,
    );
  }

  @MessagePattern('content.delete')
  async delete(@Payload() data: { contentId: string }) {
    this.logger.log('TCP content deletion request', {
      contentId: data.contentId,
    });
    return await this.contentService.deleteContent(data.contentId);
  }

  // ==================== 중간테이블 조회 패턴 ====================

  @MessagePattern('userInteraction.getContentIds')
  async getContentIdsByUserId(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user interactions request: ${data.userId}`);
    return await this.userInteractionService.getContentIds(data.userId);
  }

  @MessagePattern('userInteraction.getUserIds')
  async getUserIdsByContentId(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP content interactions request: ${data.contentId}`);
    return await this.userInteractionService.getUserIds(data.contentId);
  }

  @MessagePattern('userInteraction.getBookmarkedContentIds')
  async getBookmarkedContentIds(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user bookmarks request: ${data.userId}`);
    return await this.userInteractionService.getBookmarkedContentIds(data.userId);
  }

  @MessagePattern('userInteraction.getLikedContentIds')
  async getLikedContentIds(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user likes request: ${data.userId}`);
    return await this.userInteractionService.getLikedContentIds(data.userId);
  }

  @MessagePattern('userInteraction.exists')
  async checkInteractionExists(
    @Payload() data: { userId: string; contentId: string },
  ) {
    this.logger.debug('TCP interaction check request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.exists(data.userId, data.contentId);
  }

  @MessagePattern('userInteraction.isBookmarked')
  async isBookmarked(@Payload() data: { userId: string; contentId: string }) {
    this.logger.debug('TCP bookmark check request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.isBookmarked(data.userId, data.contentId);
  }

  @MessagePattern('userInteraction.isLiked')
  async isLiked(@Payload() data: { userId: string; contentId: string }) {
    this.logger.debug('TCP like check request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.isLiked(data.userId, data.contentId);
  }

  @MessagePattern('userInteraction.getContentIdsBatch')
  async getContentIdsBatch(@Payload() data: { userIds: string[] }) {
    this.logger.debug('TCP batch content IDs request', {
      userCount: data.userIds.length,
    });
    return await this.userInteractionService.getContentIdsBatch(data.userIds);
  }

  @MessagePattern('userInteraction.hasUsersForContent')
  async hasUsersForContent(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP content has users check: ${data.contentId}`);
    return await this.userInteractionService.hasUsersForContent(data.contentId);
  }

  // ==================== 상호작용 변경 패턴 ====================

  @MessagePattern('userInteraction.bookmark')
  async bookmarkContent(@Payload() dto: BookmarkContentDto) {
    this.logger.log('TCP bookmark creation request', {
      userId: dto.userId,
      contentId: dto.contentId,
    });
    return await this.userInteractionService.bookmarkContent(dto);
  }

  @MessagePattern('userInteraction.removeBookmark')
  async removeBookmark(@Payload() data: { userId: string; contentId: string }) {
    this.logger.log('TCP bookmark removal request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.removeBookmark(data.userId, data.contentId);
  }

  @MessagePattern('userInteraction.like')
  async likeContent(@Payload() dto: LikeContentDto) {
    this.logger.log('TCP like creation request', {
      userId: dto.userId,
      contentId: dto.contentId,
    });
    return await this.userInteractionService.likeContent(dto);
  }

  @MessagePattern('userInteraction.removeLike')
  async removeLike(@Payload() data: { userId: string; contentId: string }) {
    this.logger.log('TCP like removal request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.removeLike(data.userId, data.contentId);
  }

  @MessagePattern('userInteraction.watch')
  async watchContent(@Payload() dto: WatchContentDto) {
    this.logger.log('TCP watch record request', {
      userId: dto.userId,
      contentId: dto.contentId,
      watchDuration: dto.watchDuration,
    });
    return await this.userInteractionService.watchContent(dto);
  }

  @MessagePattern('userInteraction.rate')
  async rateContent(@Payload() dto: RateContentDto) {
    this.logger.log('TCP rating request', {
      userId: dto.userId,
      contentId: dto.contentId,
      rating: dto.rating,
    });
    return await this.userInteractionService.rateContent(dto);
  }

  // ==================== 통계 패턴 ====================

  @MessagePattern('content.getContentCount')
  async getContentCount(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP content count request: ${data.creatorId}`);
    return await this.contentService.getContentCountByCreatorId(data.creatorId);
  }

  @MessagePattern('userInteraction.getBookmarkCount')
  async getBookmarkCount(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP bookmark count request: ${data.contentId}`);
    return await this.userInteractionService.getBookmarkCount(data.contentId);
  }

  @MessagePattern('userInteraction.getLikeCount')
  async getLikeCount(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP like count request: ${data.contentId}`);
    return await this.userInteractionService.getLikeCount(data.contentId);
  }

  @MessagePattern('userInteraction.getUserInteractionCount')
  async getUserInteractionCount(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user interaction count request: ${data.userId}`);
    return await this.userInteractionService.getUserInteractionCount(data.userId);
  }

  @MessagePattern('userInteraction.getUserBookmarkCount')
  async getUserBookmarkCount(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user bookmark count request: ${data.userId}`);
    return await this.userInteractionService.getUserBookmarkCount(data.userId);
  }

  @MessagePattern('userInteraction.getUserLikeCount')
  async getUserLikeCount(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user like count request: ${data.userId}`);
    return await this.userInteractionService.getUserLikeCount(data.userId);
  }

  // ==================== 상세 조회 패턴 ====================

  @MessagePattern('userInteraction.getDetail')
  async getInteractionDetail(
    @Payload() data: { userId: string; contentId: string },
  ) {
    this.logger.debug('TCP interaction detail request', {
      userId: data.userId,
      contentId: data.contentId,
    });
    return await this.userInteractionService.getInteractionDetail(
      data.userId,
      data.contentId,
    );
  }

  @MessagePattern('userInteraction.getByUserId')
  async getInteractionsByUserId(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user all interactions request: ${data.userId}`);
    return await this.userInteractionService.getInteractionsByUserId(data.userId);
  }

  @MessagePattern('userInteraction.getByContentId')
  async getInteractionsByContentId(@Payload() data: { contentId: string }) {
    this.logger.debug(`TCP content all interactions request: ${data.contentId}`);
    return await this.userInteractionService.getInteractionsByContentId(data.contentId);
  }

  @MessagePattern('userInteraction.getWatchHistory')
  async getWatchHistory(@Payload() data: { userId: string; limit?: number }) {
    this.logger.debug('TCP watch history request', {
      userId: data.userId,
      limit: data.limit || 50,
    });
    return await this.userInteractionService.getWatchHistory(data.userId, data.limit);
  }

  @MessagePattern('userInteraction.getTopRatedContent')
  async getTopRatedContent(@Payload() data: { limit?: number }) {
    this.logger.debug('TCP top rated content request', {
      limit: data.limit || 20,
    });
    return await this.userInteractionService.getTopRatedContent(data.limit);
  }
}