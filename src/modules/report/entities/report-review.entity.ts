import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('report_review')
@Index(['reviewerId']) // 검토자별 조회 최적화
@Index(['reviewedAt']) // 검토일 기준 정렬 최적화
export class ReportReviewEntity {
  @PrimaryColumn({ comment: '외래키(reports.id)이자 기본키 - 1:1 관계 최적화' })
  reportId!: string;

  @Column({ 
    nullable: true,
    comment: '검토자 ID (관리자)'
  })
  reviewerId?: string;

  @Column({ 
    nullable: true,
    comment: '검토 처리 시간'
  })
  reviewedAt?: Date;

  @Column({ 
    type: 'text', 
    nullable: true,
    comment: '검토 의견/코멘트'
  })
  reviewComment?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}