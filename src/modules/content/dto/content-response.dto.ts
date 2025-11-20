import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { ContentQuality } from '../enums/index.js';

/**
 * Creator User 정보
 */
export class CreatorUserInfo {
  @SwaggerApiProperty({
    description: '사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @SwaggerApiProperty({
    description: '사용자 이름',
    example: 'John Doe',
  })
  name!: string;

  @SwaggerApiProperty({
    description: '이메일',
    example: 'john@example.com',
  })
  email!: string;

  @SwaggerApiProperty({
    description: '프로필 이미지',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  profileImage?: string;
}

/**
 * Creator 정보 (User 정보 포함)
 */
export class CreatorInfo {
  @SwaggerApiProperty({
    description: '크리에이터 ID',
    example: 'ado',
  })
  id!: string;

  @SwaggerApiProperty({
    description: '크리에이터 이름',
    example: 'Ado',
  })
  name!: string;

  @SwaggerApiProperty({
    description: '표시 이름',
    example: 'Ado Official',
    required: false,
  })
  displayName?: string;

  @SwaggerApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/ado-profile.jpg',
    required: false,
  })
  profileImageUrl?: string;

  @SwaggerApiProperty({
    description: '크리에이터 사용자 정보',
    type: CreatorUserInfo,
    example: null,
    required: false,
  })
  user?: CreatorUserInfo;
}

/**
 * Content Statistics
 */
export class ContentStatistics {
  @SwaggerApiProperty({
    description: '조회수',
    example: 1000000,
  })
  views!: number;

  @SwaggerApiProperty({
    description: '좋아요 수',
    example: 50000,
  })
  likes!: number;

  @SwaggerApiProperty({
    description: '댓글 수',
    example: 3000,
  })
  comments!: number;

  @SwaggerApiProperty({
    description: '공유 수',
    example: 1000,
  })
  shares!: number;

  @SwaggerApiProperty({
    description: '참여율',
    example: 5.5,
  })
  engagementRate!: number;

  @SwaggerApiProperty({
    description: '통계 업데이트 시간',
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt!: string;
}

/**
 * Content Sync Info
 */
export class ContentSyncInfo {
  @SwaggerApiProperty({
    description: '마지막 동기화 시간',
    example: '2025-01-15T10:30:00Z',
    required: false,
  })
  lastSyncedAt?: string;

  @SwaggerApiProperty({
    description: '만료 시간',
    example: '2025-01-20T10:30:00Z',
    required: false,
  })
  expiresAt?: string;

  @SwaggerApiProperty({
    description: '인증된 데이터 여부',
    example: true,
    required: false,
  })
  isAuthorizedData?: boolean;

  @SwaggerApiProperty({
    description: '동기화 에러 메시지',
    example: null,
    required: false,
  })
  syncError?: string;

  @SwaggerApiProperty({
    description: '동기화 재시도 횟수',
    example: 0,
    required: false,
  })
  syncRetryCount?: number;

  @SwaggerApiProperty({
    description: '다음 동기화 시간',
    example: '2025-01-16T10:30:00Z',
    required: false,
  })
  nextSyncAt?: string;

  @SwaggerApiProperty({
    description: '동기화 상태',
    example: 'synced',
  })
  syncStatus!: string;
}

/**
 * Content with Creator 정보
 */
export class ContentWithCreatorDto {
  @SwaggerApiProperty({
    description: '콘텐츠 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @SwaggerApiProperty({
    description: '콘텐츠 타입',
    example: 'video',
  })
  type!: string;

  @SwaggerApiProperty({
    description: '제목',
    example: 'うっせぇわ / Usseewa',
  })
  title!: string;

  @SwaggerApiProperty({
    description: '설명',
    example: 'Ado - うっせぇわ Official Music Video',
    required: false,
  })
  description?: string;

  @SwaggerApiProperty({
    description: '썸네일 URL',
    example: 'https://i.ytimg.com/vi/Qp3b-RXtz4w/maxresdefault.jpg',
  })
  thumbnail!: string;

  @SwaggerApiProperty({
    description: '콘텐츠 URL',
    example: 'https://www.youtube.com/watch?v=Qp3b-RXtz4w',
  })
  url!: string;

  @SwaggerApiProperty({
    description: '플랫폼',
    example: 'youtube',
  })
  platform!: string;

  @SwaggerApiProperty({
    description: '플랫폼 ID',
    example: 'Qp3b-RXtz4w',
  })
  platformId!: string;

  @SwaggerApiProperty({
    description: '재생 시간 (초)',
    example: 210,
    required: false,
  })
  duration?: number;

  @SwaggerApiProperty({
    description: '게시 시간',
    example: '2020-10-23T09:00:00Z',
  })
  publishedAt!: string;

  @SwaggerApiProperty({
    description: '언어',
    example: 'ja',
    required: false,
  })
  language?: string;

  @SwaggerApiProperty({
    description: '라이브 여부',
    example: false,
  })
  isLive!: boolean;

  @SwaggerApiProperty({
    description: '콘텐츠 품질',
    enum: ContentQuality,
    example: ContentQuality.HD,
    required: false,
  })
  quality?: ContentQuality;

  @SwaggerApiProperty({
    description: '연령 제한 여부',
    example: false,
  })
  ageRestriction!: boolean;

  @SwaggerApiProperty({
    description: '상태',
    example: 'active',
  })
  status!: string;

  @SwaggerApiProperty({
    description: '통계 정보',
    type: ContentStatistics,
    example: null,
    required: false,
  })
  statistics?: ContentStatistics;

  @SwaggerApiProperty({
    description: '동기화 정보',
    type: ContentSyncInfo,
    example: null,
    required: false,
  })
  syncInfo?: ContentSyncInfo;

  @SwaggerApiProperty({
    description: '생성 시간',
    example: '2025-01-15T10:00:00Z',
  })
  createdAt!: string;

  @SwaggerApiProperty({
    description: '수정 시간',
    example: '2025-01-15T10:00:00Z',
  })
  updatedAt!: string;

  @SwaggerApiProperty({
    description: '삭제 시간',
    example: null,
    required: false,
  })
  deletedAt?: string | null;

  @SwaggerApiProperty({
    description: '크리에이터 정보',
    type: CreatorInfo,
    example: {},
  })
  creator!: CreatorInfo;
}
