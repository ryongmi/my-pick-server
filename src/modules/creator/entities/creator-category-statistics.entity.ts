import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('creator_category_statistics')
@Index(['creatorId']) // 크리에이터별 카테고리 통계 조회 최적화
@Index(['category']) // 카테고리별 통계 조회 최적화
@Index(['creatorId', 'category']) // 복합 인덱스 (기본키이지만 명시적 선언)
@Index(['updatedAt']) // 최근 업데이트 기준 조회 최적화
@Index(['contentCount']) // 콘텐츠 수 기준 정렬 최적화
@Index(['viewCount']) // 조회수 기준 정렬 최적화
export class CreatorCategoryStatisticsEntity {
  @PrimaryColumn({ comment: '크리에이터 ID (creators.id)' })
  creatorId!: string;

  @PrimaryColumn({ comment: '카테고리 (gaming, music, education 등)' })
  category!: string;

  @Column({
    default: 0,
    comment: '해당 카테고리 콘텐츠 수',
  })
  contentCount!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 카테고리 총 조회수',
  })
  viewCount!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '해당 카테고리 평균 조회수',
  })
  averageViews!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 카테고리 총 좋아요 수',
  })
  totalLikes!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 카테고리 총 댓글 수',
  })
  totalComments!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 카테고리 총 공유 수',
  })
  totalShares!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '해당 카테고리 평균 참여율 (%)',
  })
  averageEngagementRate!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '해당 카테고리 콘텐츠 성장률 (월간 %)',
  })
  contentGrowthRate!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '해당 카테고리 조회수 성장률 (월간 %)',
  })
  viewGrowthRate!: number;

  @Column({
    nullable: true,
    comment: '해당 카테고리 통계 마지막 계산 시간',
  })
  lastCalculatedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
