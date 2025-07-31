import { Entity, Column } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType, SyncStatus, VideoSyncStatus } from '@common/enums/index.js';

@Entity('creator_platforms')
export class CreatorPlatformEntity extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  creatorId!: string; // FK 없이 creatorId 저장해서 직접 조회

  @Column({ type: 'enum', enum: PlatformType })
  type!: PlatformType;

  @Column()
  platformId!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ default: 0 })
  followerCount!: number;

  @Column({ default: 0 })
  contentCount!: number;

  @Column({ type: 'bigint', default: 0 })
  totalViews!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.ACTIVE })
  syncStatus!: SyncStatus;

  // ==================== 영상 동기화 관리 ====================
  
  @Column({ type: 'enum', enum: VideoSyncStatus, default: VideoSyncStatus.NEVER_SYNCED })
  videoSyncStatus!: VideoSyncStatus; // 영상 동기화 상태

  @Column({ nullable: true })
  lastVideoSyncAt?: Date; // 마지막 영상 동기화 시점

  @Column({ nullable: true })
  totalVideoCount?: number; // 채널 총 영상 수 (진행률 계산용)

  @Column({ nullable: true })
  syncedVideoCount?: number; // 동기화된 영상 수
}

