import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_moderation')
@Index(['moderationStatus']) // 상태별 조회 최적화
@Index(['moderatorId']) // 모더레이터별 조회 최적화
@Index(['moderatedAt']) // 모더레이션 일시 조회 최적화
@Index(['moderationStatus', 'moderatedAt']) // 상태별 최신순 조회 최적화
export class ContentModerationEntity {
  @PrimaryColumn({ comment: '외래키(content.id)이자 기본키 - 1:1 관계 최적화' })
  contentId!: string;

  @Column({ 
    type: 'enum', 
    enum: ['active', 'inactive', 'flagged', 'removed'], 
    default: 'active',
    comment: '콘텐츠 모더레이션 상태'
  })
  moderationStatus!: 'active' | 'inactive' | 'flagged' | 'removed';

  @Column({ 
    type: 'text', 
    nullable: true,
    comment: '상태 변경 사유'
  })
  reason?: string;

  @Column({ 
    nullable: true,
    comment: '모더레이션 처리자 ID'
  })
  moderatorId?: string;

  @Column({ 
    nullable: true,
    comment: '모더레이션 처리 시간'
  })
  moderatedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}