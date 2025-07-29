import { Exclude, Expose } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, Min } from 'class-validator';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export class AdminUserSearchQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // 이메일이나 이름에서 검색

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsDateString()
  registeredAfter?: string;

  @IsOptional()
  @IsDateString()
  registeredBefore?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['createdAt', 'lastLoginAt', 'email'])
  sortBy?: 'createdAt' | 'lastLoginAt' | 'email' = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AdminUserListItemDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name?: string;

  @Expose()
  status: UserStatus;

  @Expose()
  isEmailVerified: boolean;

  @Expose()
  registeredAt: Date;

  @Expose()
  lastLoginAt?: Date;

  @Expose()
  subscriptionCount: number;

  @Expose()
  interactionCount: number;

  @Expose()
  reportCount: number;

  @Expose()
  isCreator: boolean;
}

export class AdminUserDetailDto extends AdminUserListItemDto {
  @Expose()
  profile?: {
    avatar?: string;
    bio?: string;
    location?: string;
    website?: string;
  };

  @Expose()
  preferences?: {
    language: string;
    timezone: string;
    notifications: any;
  };

  @Expose()
  subscriptions: Array<{
    creatorId: string;
    creatorName: string;
    subscribedAt: Date;
  }>;

  @Expose()
  recentInteractions: Array<{
    contentId: string;
    contentTitle: string;
    type: 'view' | 'like' | 'bookmark' | 'comment';
    interactedAt: Date;
  }>;

  @Expose()
  reports: Array<{
    id: string;
    targetType: 'content' | 'creator' | 'user';
    targetId: string;
    reason: string;
    status: 'pending' | 'reviewed' | 'resolved';
    reportedAt: Date;
  }>;

  @Expose()
  moderationHistory: Array<{
    action: 'warned' | 'suspended' | 'banned' | 'unbanned';
    reason?: string;
    duration?: number; // 일 단위
    moderatedBy: string;
    moderatedAt: Date;
  }>;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  suspensionDays?: number; // 정지 기간 (일)

  @IsString()
  moderatedBy: string; // 관리자 ID
}