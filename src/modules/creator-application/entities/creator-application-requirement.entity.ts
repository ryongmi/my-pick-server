import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

export enum RequirementCategory {
  CHANNEL_VERIFICATION = 'channel_verification',
  CONTENT_QUALITY = 'content_quality',
  LEGAL_COMPLIANCE = 'legal_compliance',
  TECHNICAL_REQUIREMENT = 'technical_requirement',
  DOCUMENTATION = 'documentation',
  OTHER = 'other',
}

export enum RequirementStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_APPLICABLE = 'not_applicable',
}

@Entity('creator_application_requirements')
@Index(['reviewId']) // 검토별 요구사항 조회 최적화
@Index(['reviewId', 'status']) // 검토별 상태 조회 최적화
@Index(['reviewId', 'isCompleted']) // 검토별 완료 상태 조회 최적화
@Index(['category']) // 카테고리별 요구사항 조회 최적화
@Index(['priority']) // 우선순위별 정렬 최적화
export class CreatorApplicationRequirementEntity extends BaseEntityUUID {
  @Column('uuid', { comment: '검토 ID (1:N 관계 FK)' })
  reviewId!: string;

  @Column({ comment: '요구사항 내용' })
  requirement!: string;

  @Column({ type: 'enum', enum: RequirementCategory, comment: '요구사항 카테고리' })
  category!: RequirementCategory;

  @Column({ type: 'enum', enum: RequirementStatus, default: RequirementStatus.PENDING, comment: '요구사항 상태' })
  status!: RequirementStatus;

  @Column({ default: false, comment: '완료 여부' })
  isCompleted!: boolean;

  @Column('tinyint', { default: 1, comment: '우선순위 (1=높음, 5=낮음)' })
  priority!: number;

  @Column({ nullable: true, comment: '예상 완료 시간 (일)' })
  estimatedDays?: number;

  @Column({ nullable: true, comment: '완료일시' })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true, comment: '추가 설명/가이드' })
  description?: string;

  @Column({ nullable: true, comment: '관련 URL (가이드, 문서 등)' })
  relatedUrl?: string;
}