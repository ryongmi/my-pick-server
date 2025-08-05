import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('content_statistics')
@Index(['views']) // 조회수 기준 정렬 최적화
@Index(['likes']) // 좋아요 기준 정렬 최적화
@Index(['engagementRate']) // 참여율 기준 정렬 최적화
export class ContentStatisticsEntity {
  @PrimaryColumn({ comment: '외래키(content.id)이자 기본키 - 1:1 관계 최적화' })
  contentId!: string;

  @Column({ type: 'bigint', default: 0 })
  views!: number;

  @Column({ default: 0 })
  likes!: number;

  @Column({ default: 0 })
  comments!: number;

  @Column({ default: 0 })
  shares!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // FK 없이 contentId 저장해서 직접 조회
}