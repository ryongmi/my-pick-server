import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreatorService } from '../services/index.js';
import { UserSubscriptionService } from '../../user-subscription/user-subscription.service.js';
import { CreatorSearchQueryDto } from '../dto/index.js';

@Controller()
export class CreatorTcpController {
  private readonly logger = new Logger(CreatorTcpController.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly userSubscriptionService: UserSubscriptionService
  ) {}

  // ==================== 단일 도메인 조회 패턴 ====================

  @MessagePattern('creator.findById')
  async findById(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator detail request: ${data.creatorId}`);
    return await this.creatorService.findById(data.creatorId);
  }

  @MessagePattern('creator.findByIds')
  async findByIds(@Payload() data: { creatorIds: string[] }) {
    this.logger.debug(`TCP creator bulk fetch request`, {
      count: data.creatorIds.length,
    });
    return await this.creatorService.findByIds(data.creatorIds);
  }

  @MessagePattern('creator.findByCategory')
  async findByCategory(@Payload() data: { category: string }) {
    this.logger.debug(`TCP creator category request: ${data.category}`);
    return await this.creatorService.findByCategory(data.category);
  }

  @MessagePattern('creator.search')
  async search(@Payload() query: CreatorSearchQueryDto) {
    this.logger.debug('TCP creator search request', {
      hasNameFilter: !!query.name,
      category: query.category,
      page: query.page,
    });
    return await this.creatorService.searchCreators(query);
  }

  @MessagePattern('creator.getDetail')
  async getDetail(@Payload() data: { creatorId: string; userId?: string }) {
    this.logger.debug('TCP creator detail request', {
      creatorId: data.creatorId,
      hasUserId: !!data.userId,
    });
    return await this.creatorService.getCreatorById(data.creatorId, data.userId);
  }

  // ==================== 통계 패턴 ====================

  @MessagePattern('creator.getSubscriberCount')
  async getSubscriberCount(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator subscriber count request: ${data.creatorId}`);
    return await this.userSubscriptionService.getSubscriberCount(data.creatorId);
  }
}

