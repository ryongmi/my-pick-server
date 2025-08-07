import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('content_interactions')
@Index(['contentId'])
@Index(['userId'])
@Index(['contentId', 'interactionType'])
@Index(['userId', 'interactionType'])
@Index(['contentId', 'userId'], { unique: true })
export class ContentInteractionEntity {
  @PrimaryColumn()
  contentId!: string;

  @PrimaryColumn()
  userId!: string;

  @Column({ type: 'enum', enum: ['view', 'like', 'bookmark', 'share', 'comment'], default: 'view' })
  interactionType!: 'view' | 'like' | 'bookmark' | 'share' | 'comment';

  @Column({ default: false })
  isBookmarked!: boolean;

  @Column({ default: false })
  isLiked!: boolean;

  @Column({ default: false })
  isShared!: boolean;

  @Column({ nullable: true })
  watchedAt?: Date; // 시청 시간

  @Column({ nullable: true })
  watchDuration?: number; // 시청 지속 시간 (초)

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  watchPercentage?: number; // 시청 비율 (0.0-100.0)

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number; // 사용자 평점 (1.0-5.0)

  @Column({ type: 'text', nullable: true })
  comment?: string; // 사용자 코멘트

  @Column({ nullable: true })
  deviceType?: string; // 디바이스 타입 (mobile, desktop, tablet)

  @Column({ nullable: true })
  referrer?: string; // 유입 경로

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}