import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('creator_platform_statistics')
@Index(['creatorId']) // 크리에이터별 플랫폼 통계 조회 최적화
@Index(['platform']) // 플랫폼별 통계 조회 최적화
@Index(['creatorId', 'platform']) // 복합 인덱스 (기본키이지만 명시적 선언)
@Index(['updatedAt']) // 최근 업데이트 기준 조회 최적화
export class CreatorPlatformStatisticsEntity {
  @PrimaryColumn({ comment: '크리에이터 ID (creators.id)' })
  creatorId!: string;

  @PrimaryColumn({ comment: '플랫폼 타입 (youtube, twitter, instagram 등)' })
  platform!: string;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 플랫폼 팔로워 수',
  })
  followers!: number;

  @Column({
    default: 0,
    comment: '해당 플랫폼 콘텐츠 수',
  })
  content!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 플랫폼 총 조회수',
  })
  views!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '해당 플랫폼 참여율 (%)',
  })
  engagementRate!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 플랫폼 총 좋아요 수',
  })
  likes!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 플랫폼 총 댓글 수',
  })
  comments!: number;

  @Column({
    type: 'bigint',
    default: 0,
    comment: '해당 플랫폼 총 공유 수',
  })
  shares!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '해당 플랫폼 평균 조회수',
  })
  averageViews?: number | null;

  @Column({
    nullable: true,
    comment: '해당 플랫폼 통계 마지막 계산 시간',
  })
  lastCalculatedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
