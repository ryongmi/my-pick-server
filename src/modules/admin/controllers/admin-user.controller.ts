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
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';
import { CreatorService } from '../../creator/services/index.js';
import {
  AdminUserSearchQueryDto,
  AdminUserListItemDto,
  AdminUserDetailDto,
  UpdateUserStatusDto,
  UserStatus,
} from '../dto/index.js';
import { PaginatedResult } from '../../creator/dto/index.js';
import { AdminException } from '../exceptions/index.js';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { AuthGuard, RequirePermission, CurrentUser } from '@krgeobuk/authorization';

// 임시 인터페이스 (실제로는 @krgeobuk/authorization에서 import)
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const AuthGuard = () => () => {};
const CurrentUser = () => (target: any, propertyKey: string, parameterIndex: number) => {};
const RequirePermission = (permission: string) => () => {};

@Controller('admin/users')
export class AdminUserController {
  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly userInteractionService: UserInteractionService,
    private readonly creatorService: CreatorService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  @Get()
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.users.read')
  async getUserList(
    @Query() query: AdminUserSearchQueryDto,
    // @CurrentUser() admin: UserInfo,
  ): Promise<PaginatedResult<AdminUserListItemDto>> {
    try {
      // TODO: auth-service에서 사용자 목록 조회
      // const usersResult = await this.authClient.send('user.search', query).toPromise();
      
      // 임시 데이터
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User One',
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          registeredAt: new Date('2024-01-15'),
          lastLoginAt: new Date('2024-07-20'),
        },
        {
          id: 'user2',
          email: 'user2@example.com',
          name: 'User Two',
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          registeredAt: new Date('2024-02-10'),
          lastLoginAt: new Date('2024-07-19'),
        },
      ];

      // 각 사용자의 추가 정보 조회
      const enrichedUsers = await Promise.all(
        mockUsers.map(async (user) => {
          const [subscriptionCount, interactionCount] = await Promise.all([
            this.userSubscriptionService.getSubscriptionCount(user.id),
            this.userInteractionService.getUserInteractionCount(user.id),
          ]);

          // 크리에이터 여부 확인
          const isCreator = await this.checkIfUserIsCreator(user.id);

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

      return new PaginatedResult(
        enrichedUsers,
        mockUsers.length, // TODO: 실제 총 개수
        query.page || 1,
        query.limit || 20,
      );
    } catch (error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.users.read')
  async getUserDetail(
    @Param('id', ParseUUIDPipe) userId: string,
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminUserDetailDto> {
    try {
      // TODO: auth-service에서 사용자 상세 정보 조회
      // const userDetail = await this.authClient.send('user.findById', { userId }).toPromise();
      
      // 임시 데이터
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'User Name',
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        registeredAt: new Date('2024-01-15'),
        lastLoginAt: new Date('2024-07-20'),
        profile: {
          avatar: 'https://example.com/avatar.jpg',
          bio: 'User biography',
          location: 'Seoul, Korea',
          website: 'https://user-website.com',
        },
        preferences: {
          language: 'ko',
          timezone: 'Asia/Seoul',
          notifications: {
            email: true,
            push: true,
          },
        },
      };

      // 추가 정보 조회
      const [
        subscriptionCount,
        interactionCount,
        subscriptions,
        recentInteractions,
      ] = await Promise.all([
        this.userSubscriptionService.getSubscriptionCount(userId),
        this.userInteractionService.getUserInteractionCount(userId),
        this.getUserSubscriptions(userId),
        this.getUserRecentInteractions(userId),
      ]);

      const isCreator = await this.checkIfUserIsCreator(userId);

      return plainToInstance(AdminUserDetailDto, {
        ...mockUser,
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
  // @RequirePermission('admin.users.moderate')
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

      // TODO: auth-service에 사용자 상태 업데이트 요청
      // await this.authClient.send('user.updateStatus', {
      //   userId,
      //   status: dto.status,
      //   reason: dto.reason,
      //   suspensionDays: dto.suspensionDays,
      //   moderatedBy: dto.moderatedBy,
      // }).toPromise();

      // 임시 로깅
      console.log(`User ${userId} status updated to ${dto.status} by ${dto.moderatedBy}`);
      
      if (dto.status === UserStatus.SUSPENDED && dto.suspensionDays) {
        console.log(`User suspended for ${dto.suspensionDays} days`);
      }

      // TODO: 모더레이션 이력 저장
      // TODO: 상태에 따른 추가 액션 (알림, 세션 무효화 등)
    } catch (error: unknown) {
      throw AdminException.userStatusUpdateError();
    }
  }

  @Get(':id/activity')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.users.activity')
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
  // @RequirePermission('admin.users.reports')
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
      // TODO: 사용자 관련 신고 조회 구현
      
      return {
        reportsByUser: [], // 사용자가 신고한 목록
        reportsAgainstUser: [], // 사용자에 대한 신고 목록
      };
    } catch (error: unknown) {
      throw AdminException.userDataFetchError();
    }
  }

  @Get('statistics/overview')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.users.stats')
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