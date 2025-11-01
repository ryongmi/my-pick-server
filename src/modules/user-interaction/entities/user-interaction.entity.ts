import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_interactions')
@Index(['userId'])
@Index(['contentId'])
@Index(['userId', 'isBookmarked'])
@Index(['userId', 'isLiked'])
@Index(['contentId', 'isLiked'])
@Index(['userId', 'contentId'], { unique: true })
export class UserInteractionEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string; // 외래키 (auth-server User.id)

  @PrimaryColumn({ type: 'uuid' })
  contentId!: string; // 외래키 (ContentEntity.id)

  @Column({ default: false })
  isBookmarked!: boolean;

  @Column({ default: false })
  isLiked!: boolean;

  @Column({ type: 'datetime', nullable: true })
  watchedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  watchDuration?: number | null; // 초 단위

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number | null; // 1.0 ~ 5.0

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
