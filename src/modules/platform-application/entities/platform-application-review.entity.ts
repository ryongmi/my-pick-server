import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { RejectionReason } from '../enums/index.js';

@Entity('platform_application_reviews')
export class PlatformApplicationReviewEntity {
  @PrimaryColumn('uuid', { comment: '신청 ID (1:1 관계 부모 PK 사용)' })
  applicationId!: string; // PlatformApplicationEntity의 ID와 동일

  @Column('simple-array', { nullable: true })
  reasons?: RejectionReason[]; // 표준화된 거부 사유들 (다중 선택 가능)

  @Column({ type: 'text', nullable: true })
  customReason?: string; // 기타 사유일 때의 상세 설명

  @Column({ type: 'text', nullable: true })
  comment?: string; // 관리자 코멘트

  @Column('simple-array', { nullable: true })
  requirements?: string[]; // 추가 요구사항

  @Column({ type: 'text', nullable: true })
  reason?: string; // 기존 호환성을 위한 필드

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}