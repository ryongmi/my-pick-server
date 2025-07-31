import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Inject,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { ReportService } from '../../report/services/index.js';
import {
  AdminUserSearchQueryDto,
  AdminUserListItemDto,
  AdminUserDetailDto,
  UpdateUserStatusDto,
  UserStatus,
} from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';


@Controller('admin/users')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
export class AdminUserController {
  private readonly logger = new Logger(AdminUserController.name);

  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly userInteractionService: UserInteractionService,
    private readonly creatorService: CreatorService,
    private readonly reportService: ReportService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  @Get()
  // @UseGuards(AuthGuard)
  @RequirePermission('user:read')
  async getUserList(
    @Query() query: AdminUserSearchQueryDto,
    // @CurrentUser() admin: UserInfo,
  ): Promise<PaginatedResult<AdminUserListItemDto>> {
    try {
      // Auth-service에서 사용자 목록 조회
      const usersResult = await this.authClient.send('user.search', {
        page: query.page || 1,
        limit: query.limit || 20,
        status: query.status,
        email: query.email,
        name: query.name,
        startDate: query.startDate,
        endDate: query.endDate,
      }).toPromise();

      this.logger.debug('Users fetched from auth service', {
        totalItems: usersResult?.pageInfo?.totalItems || 0,
        page: query.page || 1,
      });

      // 응답이 없거나 에러인 경우 처리
      if (!usersResult || !usersResult.items) {
        this.logger.warn('No users data received from auth service');
        return {
          items: [],
          pageInfo: {
            totalItems: 0,
            totalPages: 0,
            page: query.page || 1,
            limit: (query.limit || 20) as LimitType,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        };
      }

      // 각 사용자의 추가 정보 조회
      const enrichedUsers = await Promise.all(
        usersResult.items.map(async (user: any) => {
          const [subscriptionCount, interactionCount] = await Promise.all([
            this.userSubscriptionService.getSubscriptionCount(user.id).catch(() => 0),
            this.userInteractionService.getUserInteractionCount(user.id).catch(() => 0),
          ]);

          // 크리에이터 여부 확인
          const isCreator = await this.checkIfUserIsCreator(user.id).catch(() => false);

          return plainToInstance(AdminUserListItemDto, {
            ...user,
            subscriptionCount,
            interactionCount,
            reportCount: 0, // TODO: 신고 수 구현 필요
            isCreator,
          }, {
            excludeExtraneousValues: true,
          });
        }),
      );

      return {
        items: enrichedUsers,
        pageInfo: usersResult.pageInfo || {
          totalItems: 0,
          totalPages: 0,
          page: query.page || 1,
          limit: query.limit || 20,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      };
    } catch (error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  @RequirePermission('user:read')
  async getUserDetail(
    @Param('id', ParseUUIDPipe) userId: string,
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminUserDetailDto> {
    try {
      // Auth-service에서 사용자 상세 정보 조회
      const userDetail = await this.authClient.send('user.findById', { userId }).toPromise();
      
      if (!userDetail) {
        this.logger.warn('User not found in auth service', { userId });
        throw AdminException.userNotFound();
      }

      this.logger.debug('User detail fetched from auth service', { userId });

      // 추가 정보 조회
      const [
        subscriptionCount,
        interactionCount,
        subscriptions,
        recentInteractions,
      ] = await Promise.all([
        this.userSubscriptionService.getSubscriptionCount(userId).catch(() => 0),
        this.userInteractionService.getUserInteractionCount(userId).catch(() => 0),
        this.getUserSubscriptions(userId).catch(() => []),
        this.getUserRecentInteractions(userId).catch(() => []),
      ]);

      const isCreator = await this.checkIfUserIsCreator(userId).catch(() => false);

      return plainToInstance(AdminUserDetailDto, {
        ...userDetail,
        subscriptionCount,
        interactionCount,
        reportCount: 0, // TODO: 신고 수 구현 필요
        isCreator,
        subscriptions,
        recentInteractions,
        reports: [], // TODO: 신고 목록 구현 필요
        moderationHistory: [], // TODO: 모더레이션 이력 구현 필요
      }, {
        excludeExtraneousValues: true,
      });
    } catch (error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('user:write')
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    try {
      // 자기 자신 모더레이션 방지
      // if (admin.id === userId) {
      //   throw AdminException.selfModerationNotAllowed();
      // }

      // Auth-service에 사용자 상태 업데이트 요청
      await this.authClient.send('user.updateStatus', {
        userId,
        status: dto.status,
        reason: dto.reason,
        suspensionDays: dto.suspensionDays,
        moderatedBy: dto.moderatedBy,
      }).toPromise();

      this.logger.log('User status updated successfully', {
        userId,
        newStatus: dto.status,
        moderatedBy: dto.moderatedBy,
        reason: dto.reason,
        suspensionDays: dto.suspensionDays,
      });

      // TODO: 모더레이션 이력 저장
      // TODO: 상태에 따른 추가 액션 (알림, 세션 무효화 등)
    } catch (error: unknown) {
      throw AdminException.userStatusUpdateError();
    }
  }

  @Get(':id/activity')
  // @UseGuards(AuthGuard)
  @RequirePermission('user:read')
  async getUserActivity(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('days') days: number = 30,
    // @CurrentUser() admin: UserInfo,
  ): Promise<{
    loginHistory: Array<{
      loginAt: Date;
      ipAddress: string;
      userAgent: string;
    }>;
    contentInteractions: Array<{
      contentId: string;
      contentTitle: string;
      interactionType: string;
      interactedAt: Date;
    }>;
    subscriptionActivity: Array<{
      creatorId: string;
      creatorName: string;
      action: 'subscribe' | 'unsubscribe';
      actionAt: Date;
    }>;
  }> {
    try {
      // TODO: 사용자 활동 이력 조회 구현
      
      return {
        loginHistory: [], // TODO: auth-service에서 로그인 이력 조회
        contentInteractions: [], // TODO: 콘텐츠 상호작용 이력 조회
        subscriptionActivity: [], // TODO: 구독 활동 이력 조회
      };
    } catch (error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Get(':id/reports')
  // @UseGuards(AuthGuard)
  @RequirePermission('user:read')
  async getUserReports(
    @Param('id', ParseUUIDPipe) userId: string,
    // @CurrentUser() admin: UserInfo,
  ): Promise<{
    reportsByUser: Array<{
      id: string;
      targetType: string;
      targetId: string;
      reason: string;
      status: string;
      reportedAt: Date;
    }>;
    reportsAgainstUser: Array<{
      id: string;
      reportedBy: string;
      reason: string;
      status: string;
      reportedAt: Date;
    }>;
  }> {
    try {
      // 사용자가 신고한 목록
      const reportsByUserResult = await this.reportService.searchReports({
        reporterId: userId,
        page: 1,
        limit: 50,
      });

      const reportsByUser = reportsByUserResult.items.map(report => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        reportedAt: report.createdAt,
      }));

      // 사용자에 대한 신고 목록
      const reportsAgainstUserResult = await this.reportService.searchReports({
        targetType: 'user' as any,
        targetId: userId,
        page: 1,
        limit: 50,
      });

      const reportsAgainstUser = reportsAgainstUserResult.items.map(report => ({
        id: report.id,
        reportedBy: report.reporterId,
        reason: report.reason,
        status: report.status,
        reportedAt: report.createdAt,
      }));

      return {
        reportsByUser,
        reportsAgainstUser,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get user reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw AdminException.userDataFetchError();
    }
  }

  @Get('statistics/overview')
  // @UseGuards(AuthGuard)
  @RequirePermission('user:read')
  async getUserStatistics(
    // @CurrentUser() admin: UserInfo,
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    bannedUsers: number;
    usersByStatus: Array<{ status: string; count: number }>;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
  }> {
    try {
      // TODO: 사용자 통계 구현
      
      return {
        totalUsers: 10000,
        activeUsers: 9500,
        suspendedUsers: 400,
        bannedUsers: 100,
        usersByStatus: [
          { status: 'active', count: 9500 },
          { status: 'inactive', count: 0 },
          { status: 'suspended', count: 400 },
          { status: 'banned', count: 100 },
        ],
        newUsersToday: 25,
        newUsersThisWeek: 180,
        newUsersThisMonth: 750,
      };
    } catch (error: unknown) {
      throw AdminException.statisticsGenerationError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async checkIfUserIsCreator(userId: string): Promise<boolean> {
    try {
      // TODO: CreatorService나 CreatorApplicationService에서 확인
      // const creator = await this.creatorService.findByUserId(userId);
      // return !!creator;
      
      // 임시 반환값
      return Math.random() > 0.8; // 20% 확률로 크리에이터
    } catch (error: unknown) {
      return false;
    }
  }

  private async getUserSubscriptions(userId: string): Promise<Array<{
    creatorId: string;
    creatorName: string;
    subscribedAt: Date;
  }>> {
    try {
      const subscriptions = await this.userSubscriptionService.getSubscriptionsByUserId(userId);
      const creatorIds = subscriptions.map(sub => sub.creatorId);
      
      if (creatorIds.length === 0) {
        return [];
      }

      const creators = await this.creatorService.findByIds(creatorIds);
      
      return subscriptions.map(sub => {
        const creator = creators.find(c => c.id === sub.creatorId);
        return {
          creatorId: sub.creatorId,
          creatorName: creator?.displayName || 'Unknown Creator',
          subscribedAt: sub.subscribedAt,
        };
      });
    } catch (error: unknown) {
      return [];
    }
  }

  private async getUserRecentInteractions(userId: string): Promise<Array<{
    contentId: string;
    contentTitle: string;
    type: 'view' | 'like' | 'bookmark' | 'comment';
    interactedAt: Date;
  }>> {
    try {
      const interactions = await this.userInteractionService.getInteractionsByUserId(userId);
      
      // TODO: Content 정보와 조인하여 제목 가져오기
      return interactions.slice(0, 10).map(interaction => ({
        contentId: interaction.contentId,
        contentTitle: 'Content Title', // TODO: 실제 콘텐츠 제목
        type: interaction.isLiked ? 'like' : interaction.isBookmarked ? 'bookmark' : 'view',
        interactedAt: interaction.updatedAt,
      }));
    } catch (error: unknown) {
      return [];
    }
  }
}