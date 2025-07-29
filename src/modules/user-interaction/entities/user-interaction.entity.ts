import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_interactions')
export class UserInteractionEntity {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  contentId: string;

  @Column({ default: false })
  isBookmarked: boolean;

  @Column({ default: false })
  isLiked: boolean;

  @Column({ nullable: true })
  watchedAt?: Date;

  @Column({ nullable: true })
  watchDuration?: number;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // FK 없이 contentId 저장해서 직접 조회
}