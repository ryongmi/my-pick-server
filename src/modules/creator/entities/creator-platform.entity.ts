import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

export enum PlatformType {
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
}

export enum VideoSyncStatus {
  NOT_SYNCED = 'not_synced',
  IN_PROGRESS = 'in_progress',
  SYNCED = 'synced',
  FAILED = 'failed',
}

// JSON 필드 타입 정의
export interface SyncProgress {
  videoSyncStatus: VideoSyncStatus;
  lastVideoSyncAt?: string; // ISO 8601 string
  syncStartedAt?: string;
  syncCompletedAt?: string;
  totalVideoCount?: number;
  syncedVideoCount?: number;
  failedVideoCount?: number;
  failedSyncCount?: number; // 동기화 실패 횟수
  lastSyncError?: string;
  syncMetadata?: Record<string, unknown>;

  // Phase 1 & 2: 페이지네이션 지원
  initialSyncCompleted?: boolean; // 최초 동기화 완료 여부
  nextPageToken?: string; // YouTube API 페이지네이션 토큰
}

@Entity('creator_platforms')
@Index(['platformType', 'platformId'], { unique: true })
@Index(['creatorId'])
@Index(['platformType', 'isActive'])
export class CreatorPlatformEntity extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  creatorId!: string;

  @Column({ type: 'enum', enum: PlatformType })
  platformType!: PlatformType;

  @Column()
  platformId!: string;

  @Column({ nullable: true })
  platformUsername?: string;

  @Column({ nullable: true })
  platformUrl?: string;

  @Column({ type: 'json', nullable: true })
  syncProgress?: SyncProgress;

  @Column({ default: true })
  isActive!: boolean;
}
