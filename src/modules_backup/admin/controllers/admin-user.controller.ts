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

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { ReportService } from '../../report/services/index.js';
import { ReportTargetType } from '../../report/enums/index.js';
import { ContentService } from '../../content/services/index.js';
import {
  AdminUserSearchQueryDto,
  AdminUserListItemDto,
  AdminUserDetailDto,
  UpdateUserStatusDto,
} from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';

@SwaggerApiTags({ tags: ['admin-users'] })
@SwaggerApiBearerAuth()
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
    private readonly contentService: ContentService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  @Get()
  @SwaggerApiOperation({
    summary: '관리자용 사용자 목록 조회',
    description: '관리자가 모든 사용자 목록을 조회합니다. 검색, 필터링, 페이지네이션을 지원합니다.',
  })
  @SwaggerApiPaginatedResponse({
    dto: AdminUserListItemDto,
    status: 200,
    description: '사용자 목록 조회 성공',
  })
  @RequirePermission('user:read')
  async getUserList(
    @Query() query: AdminUserSearchQueryDto,
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
  ): Promise<PaginatedResult<AdminUserListItemDto>> {
    try {
      // Auth-service에서 사용자 목록 조회
      const usersResult = await this.authClient
        .send('user.search', {
          page: query.page || 1,
          limit: query.limit || 20,
          status: query.status,
          email: query.email,
          name: query.name,
          startDate: query.startDate,
          endDate: query.endDate,
        })
        .toPromise();

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
        usersResult.items.map(async (user: Record<string, unknown>) => {
          const userId = user.id as string;
          const [subscriptionCount, interactionCount] = await Promise.all([
            this.userSubscriptionService.getSubscriptionCount(userId).catch(() => 0),
            this.userInteractionService.getUserInteractionCount(userId).catch(() => 0),
          ]);

          // 크리에이터 여부 확인
          const isCreator = await this.checkIfUserIsCreator(userId).catch(() => false);

          return plainToInstance(
            AdminUserListItemDto,
            {
              ...user,
              subscriptionCount,
              interactionCount,
              reportCount: await this.getUserReportCount(userId).catch(() => 0),
              isCreator,
            },
            {
              excludeExtraneousValues: true,
            }
          );
        })
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
    } catch (_error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '관리자용 사용자 상세 조회',
    description: '관리자가 특정 사용자의 상세 정보를 조회합니다. 구독, 상호작용, 신고 이력 등을 포함합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '사용자 ID' })
  @SwaggerApiOkResponse({
    dto: AdminUserDetailDto,
    status: 200,
    description: '사용자 상세 조회 성공',
  })
  @RequirePermission('user:read')
  async getUserDetail(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
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
      const [subscriptionCount, interactionCount, subscriptions, recentInteractions] =
        await Promise.all([
          this.userSubscriptionService.getSubscriptionCount(userId).catch(() => 0),
          this.userInteractionService.getUserInteractionCount(userId).catch(() => 0),
          this.getUserSubscriptions(userId).catch(() => []),
          this.getUserRecentInteractions(userId).catch(() => []),
        ]);

      const isCreator = await this.checkIfUserIsCreator(userId).catch(() => false);

      return plainToInstance(
        AdminUserDetailDto,
        {
          ...userDetail,
          subscriptionCount,
          interactionCount,
          reportCount: await this.getUserReportCount(userId).catch(() => 0),
          isCreator,
          subscriptions,
          recentInteractions,
          reports: await this.getUserReportsForDetail(userId),
          moderationHistory: await this.getUserModerationHistory(userId),
        },
        {
          excludeExtraneousValues: true,
        }
      );
    } catch (_error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user:write')
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
  ): Promise<void> {
    try {
      // 자기 자신 모더레이션 방지
      // if (admin.id === userId) {
      //   throw AdminException.selfModerationNotAllowed();
      // }

      // Auth-service에 사용자 상태 업데이트 요청
      await this.authClient
        .send('user.updateStatus', {
          userId,
          status: dto.status,
          reason: dto.reason,
          suspensionDays: dto.suspensionDays,
          moderatedBy: dto.moderatedBy,
        })
        .toPromise();

      this.logger.log('User status updated successfully', {
        userId,
        newStatus: dto.status,
        moderatedBy: dto.moderatedBy,
        reason: dto.reason,
        suspensionDays: dto.suspensionDays,
      });

      // 모더레이션 이력 저장 및 추가 액션 처리
      await this.recordModerationAction(userId, dto.status, dto.reason, _adminId);
      
      // 상태에 따른 추가 액션
      if (dto.status === 'banned' || dto.status === 'suspended') {
        this.logger.log('User restricted - additional actions may be needed', {
          userId,
          newStatus: dto.status,
          adminId: _adminId,
          note: '알림 발송 및 세션 무효화 기능은 향후 구현 예정',
        });
      }
    } catch (_error: unknown) {
      throw AdminException.userStatusUpdateError();
    }
  }

  @Get(':id/activity')
  @RequirePermission('user:read')
  async getUserActivity(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('days') _days: number = 30,
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
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
      // 사용자 존재 확인
      const userDetail = await this.authClient.send('user.findById', { userId }).toPromise();
      if (!userDetail) {
        throw AdminException.userNotFound();
      }

      // 병렬로 활동 이력 조회
      const [contentInteractionHistory, subscriptionHistory, loginHistory] = await Promise.all([
        this.getContentInteractionHistory(userId, _days),
        this.getSubscriptionActivityHistory(userId, _days),
        this.getUserLoginHistory(userId, _days)
      ]);

      return {
        loginHistory,
        contentInteractions: contentInteractionHistory,
        subscriptionActivity: subscriptionHistory,
      };
    } catch (_error: unknown) {
      if (_error instanceof Error && _error.message.includes('not found')) {
        throw _error;
      }
      this.logger.error('Failed to get user activity', {
        error: _error instanceof Error ? _error.message : 'Unknown error',
        userId,
        days: _days,
      });
      throw AdminException.userDataFetchError();
    }
  }

  @Get(':id/reports')
  @RequirePermission('user:read')
  async getUserReports(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
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

      const reportsByUser = reportsByUserResult.items.map((report) => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        reportedAt: report.createdAt,
      }));

      // 사용자에 대한 신고 목록
      const reportsAgainstUserResult = await this.reportService.searchReports({
        targetType: ReportTargetType.USER,
        targetId: userId,
        page: 1,
        limit: 50,
      });

      const reportsAgainstUser = reportsAgainstUserResult.items.map((report) => ({
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
    } catch (_error: unknown) {
      this.logger.error('Failed to get user reports', {
        error: _error instanceof Error ? _error.message : 'Unknown error',
        userId,
      });
      throw AdminException.userDataFetchError();
    }
  }

  @Get('statistics/overview')
  @RequirePermission('user:read')
  async getUserStatistics(
    @CurrentJwt() { userId: _adminId }: AuthenticatedJwt
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
      // auth-service에서 사용자 통계 조회
      const userStatistics = await this.authClient
        .send('user.getStatistics', {})
        .toPromise();

      this.logger.debug('User statistics fetched from auth service', {
        adminId: _adminId,
        totalUsers: userStatistics?.totalUsers || 0,
      });

      // auth-service 응답이 없는 경우 기본값 반환
      if (!userStatistics) {
        this.logger.warn('No user statistics received from auth service');
        return {
          totalUsers: 0,
          activeUsers: 0,
          suspendedUsers: 0,
          bannedUsers: 0,
          usersByStatus: [],
          newUsersToday: 0,
          newUsersThisWeek: 0,
          newUsersThisMonth: 0,
        };
      }

      // auth-service에서 받은 실제 통계 데이터 사용
      return {
        totalUsers: userStatistics.totalUsers || 0,
        activeUsers: userStatistics.activeUsers || 0,
        suspendedUsers: userStatistics.suspendedUsers || 0,
        bannedUsers: userStatistics.bannedUsers || 0,
        usersByStatus: userStatistics.usersByStatus || [],
        newUsersToday: userStatistics.newUsersToday || 0,
        newUsersThisWeek: userStatistics.newUsersThisWeek || 0,
        newUsersThisMonth: userStatistics.newUsersThisMonth || 0,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get user statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: _adminId,
      });

      // 에러 발생 시에도 기본값 반환 (서비스 안정성)
      return {
        totalUsers: 0,
        activeUsers: 0,
        suspendedUsers: 0,
        bannedUsers: 0,
        usersByStatus: [],
        newUsersToday: 0,
        newUsersThisWeek: 0,
        newUsersThisMonth: 0,
      };
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async checkIfUserIsCreator(userId: string): Promise<boolean> {
    try {
      // CreatorService를 통해 userId로 크리에이터 존재 여부 확인
      const creator = await this.creatorService.findByUserId(userId);
      return !!creator;
    } catch (error: unknown) {
      this.logger.warn('Failed to check if user is creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    }
  }

  private async getUserSubscriptions(userId: string): Promise<
    Array<{
      creatorId: string;
      creatorName: string;
      subscribedAt: Date;
    }>
  > {
    try {
      const subscriptions = await this.userSubscriptionService.getSubscriptionsByUserId(userId);
      const creatorIds = subscriptions.map((sub) => sub.creatorId);

      if (creatorIds.length === 0) {
        return [];
      }

      const creators = await this.creatorService.findByIds(creatorIds);

      return subscriptions.map((sub) => {
        const creator = creators.find((c) => c.id === sub.creatorId);
        return {
          creatorId: sub.creatorId,
          creatorName: creator?.displayName || 'Unknown Creator',
          subscribedAt: sub.subscribedAt,
        };
      });
    } catch (_error: unknown) {
      return [];
    }
  }

  private async getUserRecentInteractions(userId: string): Promise<
    Array<{
      contentId: string;
      contentTitle: string;
      type: 'view' | 'like' | 'bookmark' | 'comment';
      interactedAt: Date;
    }>
  > {
    try {
      const interactions = await this.userInteractionService.getInteractionsByUserId(userId);

      // Content 정보와 함께 상호작용 데이터 반환
      const interactionDetails = await Promise.all(
        interactions.slice(0, 10).map(async (interaction) => {
          const content = await this.contentService.findById(interaction.contentId);
          
          const type: 'view' | 'like' | 'bookmark' | 'comment' = 
            interaction.isLiked ? 'like' : 
            interaction.isBookmarked ? 'bookmark' : 'view';
          
          return {
            contentId: interaction.contentId,
            contentTitle: content?.title || 'Unknown Content',
            type,
            interactedAt: interaction.updatedAt,
          };
        })
      );

      return interactionDetails;
    } catch (_error: unknown) {
      return [];
    }
  }

  private async getUserReportCount(userId: string): Promise<number> {
    try {
      // 사용자에 대한 신고 수 조회
      const reportsAgainstUser = await this.reportService.searchReports({
        targetType: ReportTargetType.USER,
        targetId: userId,
        page: 1,
        limit: 1 as LimitType, // 개수만 필요하므로 limit는 1로 설정
      });

      return reportsAgainstUser.pageInfo.totalItems;
    } catch (error: unknown) {
      this.logger.warn('Failed to get user report count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return 0;
    }
  }

  private async getContentInteractionHistory(
    userId: string,
    days: number
  ): Promise<Array<{
    contentId: string;
    contentTitle: string;
    interactionType: string;
    interactedAt: Date;
  }>> {
    try {
      // UserInteractionService에서 최근 상호작용 이력 조회
      const interactions = await this.userInteractionService.getInteractionsByUserId(userId);
      
      // 기간 필터링 (days일 내)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentInteractions = interactions.filter(
        interaction => interaction.updatedAt >= cutoffDate
      );

      // Content 정보와 함께 상호작용 이력 반환
      const interactionHistory = await Promise.all(
        recentInteractions.slice(0, 50).map(async (interaction) => { // 최대 50개 제한
          const content = await this.contentService.findById(interaction.contentId);
          
          // 상호작용 타입 결정
          let interactionType = 'view';
          if (interaction.isLiked) interactionType = 'like';
          else if (interaction.isBookmarked) interactionType = 'bookmark';
          
          return {
            contentId: interaction.contentId,
            contentTitle: content?.title || 'Unknown Content',
            interactionType,
            interactedAt: interaction.updatedAt,
          };
        })
      );

      return interactionHistory.sort((a, b) => 
        new Date(b.interactedAt).getTime() - new Date(a.interactedAt).getTime()
      );
    } catch (error: unknown) {
      this.logger.warn('Failed to get content interaction history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
      });
      return [];
    }
  }

  private async getSubscriptionActivityHistory(
    userId: string,
    days: number
  ): Promise<Array<{
    creatorId: string;
    creatorName: string;
    action: 'subscribe' | 'unsubscribe';
    actionAt: Date;
  }>> {
    try {
      // UserSubscriptionService에서 구독 정보 조회
      const subscriptions = await this.userSubscriptionService.getSubscriptionsByUserId(userId);
      
      // 기간 필터링 (days일 내)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentSubscriptions = subscriptions.filter(
        subscription => subscription.subscribedAt >= cutoffDate
      );

      // Creator 정보와 함께 구독 활동 이력 반환
      const creatorIds = recentSubscriptions.map(sub => sub.creatorId);
      if (creatorIds.length === 0) return [];

      const creators = await this.creatorService.findByIds(creatorIds);

      const subscriptionHistory = recentSubscriptions.map((subscription) => {
        const creator = creators.find(c => c.id === subscription.creatorId);
        
        return {
          creatorId: subscription.creatorId,
          creatorName: creator?.displayName || creator?.name || 'Unknown Creator',
          action: 'subscribe' as const, // 현재는 구독만 추적, 구독 취소 이력은 별도 구현 필요
          actionAt: subscription.subscribedAt,
        };
      });

      return subscriptionHistory.sort((a, b) => 
        new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime()
      );
    } catch (error: unknown) {
      this.logger.warn('Failed to get subscription activity history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
      });
      return [];
    }
  }

  private async getUserReportsForDetail(userId: string): Promise<Array<{
    id: string;
    type: 'reported_by_user' | 'reported_against_user';
    targetType?: string;
    targetId?: string;
    reason: string;
    status: string;
    createdAt: Date;
  }>> {
    try {
      // 사용자가 신고한 목록과 사용자에 대한 신고 목록을 병렬로 조회
      const [reportsByUser, reportsAgainstUser] = await Promise.all([
        this.reportService.searchReports({
          reporterId: userId,
          page: 1,
          limit: 25,
        }),
        this.reportService.searchReports({
          targetType: ReportTargetType.USER,
          targetId: userId,
          page: 1,
          limit: 25,
        }),
      ]);

      const reports: Array<{
        id: string;
        type: 'reported_by_user' | 'reported_against_user';
        targetType?: string;
        targetId?: string;
        reason: string;
        status: string;
        createdAt: Date;
      }> = [];

      // 사용자가 신고한 목록 추가
      reportsByUser.items.forEach(report => {
        reports.push({
          id: report.id,
          type: 'reported_by_user',
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
        });
      });

      // 사용자에 대한 신고 목록 추가
      reportsAgainstUser.items.forEach(report => {
        reports.push({
          id: report.id,
          type: 'reported_against_user',
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
        });
      });

      // 시간순 정렬 (최신순)
      return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: unknown) {
      this.logger.warn('Failed to get user reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  private async getUserModerationHistory(userId: string): Promise<Array<{
    action: 'warning' | 'suspension' | 'ban' | 'status_change';
    reason?: string;
    moderatedBy: string;
    moderatedAt: Date;
    details?: string;
  }>> {
    try {
      // 사용자에 대한 신고 처리 이력을 모더레이션 이력으로 변환
      const reports = await this.reportService.searchReports({
        targetType: ReportTargetType.USER,
        targetId: userId,
        page: 1,
        limit: 30,
      });

      const moderationHistory: Array<{
        action: 'warning' | 'suspension' | 'ban' | 'status_change';
        reason?: string;
        moderatedBy: string;
        moderatedAt: Date;
        details?: string;
      }> = [];

      // 처리된 신고를 모더레이션 이력으로 변환
      reports.items.forEach(report => {
        if (report.status === 'resolved') {
          moderationHistory.push({
            action: 'warning',
            reason: report.reason,
            moderatedBy: 'system', // 실제로는 reviewedBy 필드가 있어야 함
            moderatedAt: report.updatedAt || report.createdAt,
            details: `신고 처리로 인한 경고: ${report.description || ''}`,
          });
        } else if (report.status === 'dismissed') {
          moderationHistory.push({
            action: 'status_change',
            reason: '신고 기각',
            moderatedBy: 'system',
            moderatedAt: report.updatedAt || report.createdAt,
            details: `신고가 부당하다고 판단되어 기각됨: ${report.reason}`,
          });
        }
      });

      // 시간순 정렬 (최신순)
      return moderationHistory.sort((a, b) => b.moderatedAt.getTime() - a.moderatedAt.getTime());
    } catch (error: unknown) {
      this.logger.warn('Failed to get user moderation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return [];
    }
  }

  private async recordModerationAction(
    userId: string,
    action: string,
    reason?: string,
    moderatedBy?: string
  ): Promise<void> {
    try {
      // 모더레이션 액션을 로그로 기록
      this.logger.log('Moderation action recorded', {
        userId,
        action,
        reason,
        moderatedBy,
        timestamp: new Date().toISOString(),
        type: 'user_moderation',
      });

      // 향후 별도의 ModerationHistoryService나 데이터베이스 테이블에 저장할 수 있음
      // 현재는 로깅으로만 처리
    } catch (error: unknown) {
      this.logger.warn('Failed to record moderation action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        action,
      });
    }
  }

  private async getUserLoginHistory(userId: string, days: number): Promise<Array<{
    loginAt: Date;
    ipAddress: string;
    userAgent: string;
  }>> {
    try {
      // auth-service에서 로그인 이력 조회 시도
      const loginHistoryResponse = await this.authClient
        .send('user.getLoginHistory', { userId, days })
        .toPromise();

      if (loginHistoryResponse && Array.isArray(loginHistoryResponse)) {
        return loginHistoryResponse.map((login: unknown) => ({
          loginAt: new Date((login as { loginAt: string }).loginAt),
          ipAddress: (login as { ipAddress: string }).ipAddress || 'Unknown',
          userAgent: (login as { userAgent: string }).userAgent || 'Unknown',
        }));
      }

      // auth-service에 해당 API가 없는 경우 빈 배열 반환
      this.logger.debug('Login history API not available in auth-service', {
        userId,
        days,
        note: 'auth-service에 user.getLoginHistory API 구현 필요',
      });

      return [];
    } catch (error: unknown) {
      this.logger.debug('Failed to get login history from auth-service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
        note: 'auth-service에서 로그인 이력 조회 실패 - API 미구현 가능성',
      });
      return [];
    }
  }
}
