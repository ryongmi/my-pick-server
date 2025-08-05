import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_interactions')
@Index(['userId']) // 사용자별 상호작용 조회 최적화
@Index(['contentId']) // 콘텐츠별 상호작용 조회 최적화
@Index(['userId', 'isBookmarked']) // 사용자 북마크 조회 최적화
@Index(['userId', 'isLiked']) // 사용자 좋아요 조회 최적화
@Index(['contentId', 'isBookmarked']) // 콘텐츠 북마크 수 조회 최적화
@Index(['contentId', 'isLiked']) // 콘텐츠 좋아요 수 조회 최적화
@Index(['userId', 'watchedAt']) // 사용자 시청 기록 조회 최적화
@Index(['rating']) // 평점 기준 조회 최적화
export class UserInteractionEntity {
  @PrimaryColumn()
  userId!: string;

  @PrimaryColumn()
  contentId!: string;

  @Column({ default: false })
  isBookmarked!: boolean;

  @Column({ default: false })
  isLiked!: boolean;

  @Column({ nullable: true })
  watchedAt?: Date;

  @Column({ nullable: true })
  watchDuration?: number;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // FK 없이 contentId 저장해서 직접 조회
}