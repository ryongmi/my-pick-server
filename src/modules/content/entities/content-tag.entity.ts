import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('content_tags')
@Index(['contentId'])
@Index(['tag'])
@Index(['contentId', 'tag'], { unique: true })
@Index(['tag', 'source'])
export class ContentTagEntity {
  @PrimaryColumn({ type: 'uuid' })
  contentId!: string; // 외래키 (ContentEntity.id)

  @PrimaryColumn()
  tag!: string;

  @Column({ type: 'enum', enum: ['platform', 'ai', 'manual'], default: 'platform' })
  source!: 'platform' | 'ai' | 'manual'; // 태그 소스

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  relevanceScore!: number; // 관련성 점수 (0.0-1.0)

  @Column({ nullable: true })
  addedBy?: string; // 태그 추가자 ID

  @Column({ default: 0 })
  usageCount!: number; // 이 태그가 사용된 횟수 (전체 콘텐츠 기준)

  @CreateDateColumn()
  createdAt!: Date;
}
