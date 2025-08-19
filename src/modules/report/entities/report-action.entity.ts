import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import { ReportActionType, ExecutionStatus } from '../enums/index.js';

@Entity('report_actions')
@Index(['actionType']) // 조치 타입별 조회 최적화
@Index(['executedAt']) // 실행일 기준 정렬 최적화
export class ReportActionEntity {
  @PrimaryColumn({ comment: '외래키(reports.id)이자 기본키 - 1:1 관계 최적화' })
  reportId!: string;

  @Column({
    type: 'enum',
    enum: ReportActionType,
    default: ReportActionType.NONE,
    comment: '조치 타입',
  })
  actionType!: ReportActionType;

  @Column({
    nullable: true,
    comment: '정지 기간 (일 단위)',
  })
  duration?: number | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '조치 사유',
  })
  reason?: string | null;

  @Column({
    nullable: true,
    comment: '조치 실행 시간',
  })
  executedAt?: Date | null;

  @Column({
    nullable: true,
    comment: '조치 실행자 ID',
  })
  executedBy?: string | null;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
    comment: '조치 실행 상태',
  })
  executionStatus!: ExecutionStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
