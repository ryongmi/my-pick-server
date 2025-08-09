import { Entity, Column, CreateDateColumn, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ApplicationStatus } from '../enums/index.js';

@Entity('creator_applications')
@Index(['userId']) // 사용자별 신청 조회 최적화
@Index(['status']) // 상태별 신청 조회 최적화
@Index(['appliedAt']) // 신청일순 조회 최적화
@Index(['reviewerId']) // 검토자별 신청 조회 최적화
export class CreatorApplicationEntity extends BaseEntityUUID {
  @Column({ type: 'uuid', comment: '신청자 사용자 ID' })
  userId!: string;

  @Column({ type: 'enum', enum: ApplicationStatus, comment: '신청 상태' })
  status!: ApplicationStatus;

  @CreateDateColumn({ comment: '신청일시' })
  appliedAt!: Date;

  @Column({ nullable: true, comment: '검토 완료일시' })
  reviewedAt?: Date | null;

  @Column({ nullable: true, comment: '최종 검토자 ID' })
  reviewerId?: string | null;

  @Column({ type: 'text', nullable: true, comment: '신청자 메시지' })
  applicantMessage?: string | null;

  @Column({ nullable: true, comment: '예상 처리 시간 (일)' })
  estimatedProcessingDays?: number | null;

  @Column({ default: 0, comment: '우선순위 (높을수록 우선)' })
  priority!: number;
}
