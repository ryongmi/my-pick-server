import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType, SyncStatus } from '@common/enums/index.js';

@Entity('creator_platforms')
@Index(['creatorId']) // 크리에이터별 플랫폼 조회 최적화
@Index(['creatorId', 'type']) // 크리에이터별 특정 플랫폼 조회 최적화
@Index(['creatorId', 'isActive']) // 활성 플랫폼만 조회 최적화
@Index(['type', 'isActive']) // 플랫폼별 활성 계정 조회 최적화
export class CreatorPlatformEntity extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  creatorId!: string; // FK 없이 creatorId 저장해서 직접 조회

  @Column({ type: 'enum', enum: PlatformType })
  type!: PlatformType;

  @Column()
  platformId!: string; // 채널 ID, 사용자명 등

  @Column()
  url!: string;

  @Column({ nullable: true })
  displayName?: string | null;

  @Column({ default: 0 })
  followerCount!: number;

  @Column({ default: 0 })
  contentCount!: number;

  @Column({ type: 'bigint', default: 0 })
  totalViews!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastSyncAt?: Date | null;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.ACTIVE })
  syncStatus!: SyncStatus;
}
