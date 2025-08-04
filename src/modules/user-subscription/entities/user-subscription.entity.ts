import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_subscriptions')
export class UserSubscriptionEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid' })
  creatorId!: string;

  @Column({ default: true })
  notificationEnabled!: boolean;

  @CreateDateColumn()
  subscribedAt!: Date;

  // FK 없이 creatorId 저장해서 직접 조회
}
