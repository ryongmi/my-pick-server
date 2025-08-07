import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';

@Entity('reports')
@Index(['targetType', 'targetId']) // 신고 대상별 조회 최적화
@Index(['reporterId']) // 신고자별 조회 최적화
@Index(['status']) // 상태별 조회 최적화
@Index(['priority']) // 우선순위별 조회 최적화
@Index(['createdAt']) // 생성일 기준 정렬 최적화
@Index(['status', 'priority']) // 상태+우선순위 조합 조회 최적화
@Index(['targetType', 'status']) // 대상 타입+상태 조합 조회 최적화
export class ReportEntity extends BaseEntityUUID {
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

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @Column({ default: 1 })
  priority!: number; // 우선순위 (1: 높음, 2: 보통, 3: 낮음)

  // 분리된 엔티티들과 연결 (FK 없이 reportId로 연결)
  // - ReportEvidenceEntity (1:1) - 증거 정보
  // - ReportReviewEntity (1:1) - 검토 정보  
  // - ReportActionEntity (1:1) - 조치 정보
}