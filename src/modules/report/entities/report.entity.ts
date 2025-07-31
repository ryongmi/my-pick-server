import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';

@Entity('reports')
@Index(['targetType', 'targetId'])
@Index(['reporterId'])
@Index(['status'])
@Index(['createdAt'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  reporterId!: string; // 신고자 ID (auth-server에서 관리)

  @Column({ type: 'enum', enum: ReportTargetType })
  targetType!: ReportTargetType;

  @Column()
  targetId!: string; // 신고 대상 ID (사용자/크리에이터/콘텐츠)

  @Column({ type: 'enum', enum: ReportReason })
  reason!: ReportReason;

  @Column({ type: 'text', nullable: true })
  description?: string; // 신고 상세 설명

  @Column({ type: 'json', nullable: true })
  evidence?: {
    screenshots?: string[]; // 스크린샷 URL 목록
    urls?: string[]; // 관련 URL 목록
    additionalInfo?: Record<string, unknown>; // 추가 정보
  };

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @Column({ nullable: true })
  reviewerId?: string; // 검토자 ID (관리자)

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true })
  reviewComment?: string; // 검토 의견

  @Column({ type: 'json', nullable: true })
  actions?: {
    actionType?: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'none';
    duration?: number; // 정지 기간 (일)
    reason?: string; // 조치 사유
  };

  @Column({ default: 1 })
  priority!: number; // 우선순위 (1: 높음, 2: 보통, 3: 낮음)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}