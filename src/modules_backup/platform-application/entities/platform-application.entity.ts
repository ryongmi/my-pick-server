import { Entity, Column } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ApplicationStatus } from '../enums/index.js';
import { PlatformData, ReviewData } from '../interfaces/index.js';

@Entity('platform_applications')
export class PlatformApplicationEntity extends BaseEntityUUID {
  @Column()
  creatorId!: string; // 신청한 크리에이터 ID

  @Column()
  userId!: string; // 신청자 사용자 ID (크리에이터 소유자)

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status!: ApplicationStatus;

  @Column({ type: 'json' })
  platformData!: PlatformData;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  reviewerId?: string; // 검토자 ID (admin)

  @Column({ type: 'json', nullable: true })
  reviewData?: ReviewData;
}