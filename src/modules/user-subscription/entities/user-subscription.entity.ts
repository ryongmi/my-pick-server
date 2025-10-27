import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_subscriptions')
@Index(['userId'])
@Index(['creatorId'])
@Index(['userId', 'creatorId'], { unique: true })
@Index(['notificationEnabled'])
export class UserSubscriptionEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string; // 외래키 (auth-server User.id)

  @PrimaryColumn({ type: 'uuid' })
  creatorId!: string; // 외래키 (CreatorEntity.id)

  @Column({ default: true })
  notificationEnabled!: boolean;

  @CreateDateColumn()
  subscribedAt!: Date;
}
