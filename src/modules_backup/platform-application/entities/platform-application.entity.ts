import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType } from '@common/enums/index.js';

import { ApplicationStatus } from '../enums/index.js';

@Entity('platform_applications')
@Index(['creatorId']) // 크리에이터별 신청 조회 최적화
@Index(['userId']) // 사용자별 신청 조회 최적화
@Index(['status']) // 상태별 신청 조회 최적화
@Index(['status', 'createdAt']) // 상태별 최신순 조회 최적화
export class PlatformApplicationEntity extends BaseEntityUUID {
  @Column()
  creatorId!: string; // 신청한 크리에이터 ID

  @Column()
  userId!: string; // 신청자 사용자 ID (크리에이터 소유자)

  @Column({ type: 'enum', enum: PlatformType })
  platformType!: PlatformType;

  @Column()
  appliedAt!: Date;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status!: ApplicationStatus;

  @Column({ nullable: true })
  reviewedAt?: Date | null;

  @Column({ nullable: true })
  reviewerId?: string | null; // 검토자 ID (admin)
}
