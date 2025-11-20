import { Entity, Column, Index } from 'typeorm';

import { SwaggerApiProperty } from '@krgeobuk/swagger';
import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType, VideoSyncStatus } from '../enums/creator-platform.enum.js';

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
  nextPageToken?: string | undefined; // YouTube API 페이지네이션 토큰 (undefined로 제거 가능)

  // Phase 3: 전체 동기화 모드
  isFullSyncMode?: boolean; // 전체 동기화 진행 중 여부
  fullSyncStartedAt?: string; // 전체 동기화 시작 시간
  fullSyncProgress?:
    | {
        // 진행 상황 추적
        syncedCount: number;
        remainingCount: number;
        progressPercent: number;
      }
    | undefined; // undefined로 제거 가능
}

@Entity('creator_platforms')
@Index(['platformType', 'platformId'], { unique: true })
@Index(['creatorId'])
@Index(['platformType', 'isActive'])
export class CreatorPlatformEntity extends BaseEntityUUID {
  @SwaggerApiProperty({
    description: '크리에이터 ID',
    example: 'ado',
  })
  @Column({ type: 'uuid' })
  creatorId!: string;

  @SwaggerApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @Column({ type: 'enum', enum: PlatformType })
  platformType!: PlatformType;

  @SwaggerApiProperty({
    description: '플랫폼 고유 ID',
    example: 'UCk2NN3Bfbv-dMLKVrx7dAjQ',
  })
  @Column()
  platformId!: string;

  @SwaggerApiProperty({
    description: '플랫폼 사용자명',
    example: '@Ado1024',
    required: false,
  })
  @Column({ nullable: true })
  platformUsername?: string;

  @SwaggerApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/@Ado1024',
    required: false,
  })
  @Column({ nullable: true })
  platformUrl?: string;

  @SwaggerApiProperty({
    description: '동기화 진행 상황',
    required: false,
    example: null,
  })
  @Column({ type: 'json', nullable: true })
  syncProgress?: SyncProgress;

  @SwaggerApiProperty({
    description: '활성화 상태',
    example: true,
  })
  @Column({ default: true })
  isActive!: boolean;
}
