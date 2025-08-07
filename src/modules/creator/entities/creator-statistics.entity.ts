import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('creator_statistics')
@Index(['updatedAt']) // 최근 업데이트 기준 조회 최적화
export class CreatorStatisticsEntity {
  @PrimaryColumn({ comment: '외래키(creators.id)이자 기본키 - 1:1 관계 최적화' })
  creatorId!: string;

  @Column({ 
    type: 'bigint', 
    default: 0,
    comment: '총 팔로워 수 (모든 플랫폼 합계)'
  })
  totalFollowers!: number;

  @Column({ 
    default: 0,
    comment: '총 콘텐츠 수'
  })
  totalContent!: number;

  @Column({ 
    type: 'bigint', 
    default: 0,
    comment: '총 조회수 (모든 플랫폼 합계)'
  })
  totalViews!: number;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    comment: '팔로워 성장률 (월간 %)'
  })
  followersGrowthRate!: number;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    comment: '콘텐츠 성장률 (월간 %)'
  })
  contentGrowthRate!: number;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    comment: '평균 참여율 (%)'
  })
  averageEngagementRate!: number;

  @Column({ 
    type: 'bigint', 
    default: 0,
    comment: '총 좋아요 수'
  })
  totalLikes!: number;

  @Column({ 
    type: 'bigint', 
    default: 0,
    comment: '총 댓글 수'
  })
  totalComments!: number;

  @Column({ 
    type: 'bigint', 
    default: 0,
    comment: '총 공유 수'
  })
  totalShares!: number;

  // 플랫폼별 통계는 CreatorPlatformStatisticsEntity로 분리
  // 카테고리별 통계는 CreatorCategoryStatisticsEntity로 분리

  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2, 
    nullable: true,
    comment: '월간 평균 조회수'
  })
  monthlyAverageViews?: number;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    nullable: true,
    comment: '콘텐츠 품질 점수 (1-100)'
  })
  contentQualityScore?: number;

  @Column({ 
    default: 0,
    comment: '활성 플랫폼 수'
  })
  activePlatformCount!: number;

  @Column({ 
    nullable: true,
    comment: '최근 통계 계산 시간'
  })
  lastCalculatedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}