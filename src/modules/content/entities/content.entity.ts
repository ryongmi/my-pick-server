import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

/**
 * 콘텐츠 통계 정보 (1:1 관계를 JSON으로 통합)
 */
export interface ContentStatistics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  updatedAt: string; // ISO 8601 날짜 문자열
}

/**
 * 콘텐츠 동기화 정보 (1:1 관계를 JSON으로 통합)
 */
export interface ContentSyncInfo {
  lastSyncedAt?: string; // ISO 8601 날짜 문자열
  expiresAt?: string; // 데이터 만료 시간 (YouTube API 30일 정책)
  isAuthorizedData?: boolean; // 인증된 데이터 여부
  syncError?: string; // 동기화 오류 메시지
  syncRetryCount?: number; // 동기화 재시도 횟수
  nextSyncAt?: string; // 다음 동기화 예정 시간
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
}

@Entity('content')
@Index(['creatorId'])
@Index(['platform', 'platformId'], { unique: true })
@Index(['publishedAt'])
@Index(['creatorId', 'publishedAt'])
@Index(['platform', 'publishedAt'])
@Index(['isLive'])
@Index(['ageRestriction'])
@Index(['language'])
@Index(['quality'])
@Index(['language', 'quality'])
@Index(['isLive', 'ageRestriction'])
export class ContentEntity extends BaseEntityUUID {
  @Column({ type: 'enum', enum: ContentType })
  type!: ContentType;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  thumbnail!: string;

  @Column()
  url!: string;

  @Column({ type: 'enum', enum: PlatformType })
  platform!: PlatformType;

  @Column()
  platformId!: string;

  @Column({ nullable: true })
  duration?: number;

  @Column()
  publishedAt!: Date;

  @Column({ type: 'uuid' })
  creatorId!: string; // 외래키 (CreatorEntity.id)

  // ==================== 메타데이터 ====================

  @Column({ nullable: true, comment: '콘텐츠 언어 (ISO 639-1)' })
  language?: string;

  @Column({ default: false, comment: '실시간 방송 여부' })
  isLive!: boolean;

  @Column({
    type: 'enum',
    enum: ['sd', 'hd', '4k'],
    nullable: true,
    comment: '영상 품질',
  })
  quality?: 'sd' | 'hd' | '4k';

  @Column({ default: false, comment: '연령 제한 콘텐츠 여부' })
  ageRestriction!: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'under_review', 'flagged', 'removed'],
    default: 'active',
    comment: '콘텐츠 상태',
  })
  status!: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed';

  // ==================== JSON 필드 통합 ====================

  /**
   * 통계 정보 (ContentStatisticsEntity 통합)
   * - 1:1 관계였으나 항상 함께 조회되므로 JSON으로 통합
   */
  @Column({ type: 'json', nullable: true })
  statistics?: ContentStatistics;

  /**
   * 동기화 정보 (ContentSyncEntity + ContentSyncMetadataEntity 통합)
   * - 1:1 관계였으나 항상 함께 조회되므로 JSON으로 통합
   */
  @Column({ type: 'json', nullable: true })
  syncInfo?: ContentSyncInfo;
}
