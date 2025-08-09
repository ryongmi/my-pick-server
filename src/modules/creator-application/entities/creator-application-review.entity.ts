import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

export enum ReviewStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUIRED = 'revision_required',
}

export enum ReviewActionType {
  STATUS_CHANGE = 'status_change',
  COMMENT_ADDED = 'comment_added',
  REQUIREMENT_ADDED = 'requirement_added',
  DOCUMENT_REVIEWED = 'document_reviewed',
}

@Entity('creator_application_reviews')
@Index(['applicationId']) // 신청서별 검토 이력 조회 최적화
@Index(['applicationId', 'status']) // 신청서별 특정 상태 검토 조회 최적화
@Index(['reviewerId']) // 검토자별 검토 이력 조회 최적화
@Index(['createdAt']) // 시간순 검토 이력 조회 최적화
export class CreatorApplicationReviewEntity extends BaseEntityUUID {
  @Column('uuid', { comment: '신청서 ID (1:N 관계 FK)' })
  applicationId!: string;

  @Column('uuid', { comment: '검토자 ID (관리자 사용자 ID)' })
  reviewerId!: string;

  @Column({ type: 'enum', enum: ReviewStatus, comment: '검토 상태' })
  status!: ReviewStatus;

  @Column({ type: 'enum', enum: ReviewActionType, comment: '검토 액션 유형' })
  actionType!: ReviewActionType;

  @Column({ type: 'text', nullable: true, comment: '검토 의견' })
  comment?: string | null;

  @Column({ type: 'text', nullable: true, comment: '거부/수정 사유' })
  reason?: string | null;

  @Column('int', { nullable: true, comment: '점수 (1-100)' })
  score?: number | null;

  @Column({ nullable: true, comment: '예상 처리 시간 (일)' })
  estimatedDays?: number | null;

  @Column({ default: false, comment: '최종 검토 여부' })
  isFinal!: boolean;
}
