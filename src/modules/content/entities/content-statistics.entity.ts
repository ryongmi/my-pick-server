import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('content_statistics')
export class ContentStatisticsEntity {
  @PrimaryColumn()
  contentId: string;

  @Column({ type: 'bigint', default: 0 })
  views: number;

  @Column({ default: 0 })
  likes: number;

  @Column({ default: 0 })
  comments: number;

  @Column({ default: 0 })
  shares: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate: number;

  @UpdateDateColumn()
  updatedAt: Date;

  // FK 없이 contentId 저장해서 직접 조회
}