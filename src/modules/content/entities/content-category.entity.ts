import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_categories')
@Index(['contentId'])
@Index(['category'])
@Index(['contentId', 'category'], { unique: true })
export class ContentCategoryEntity {
  @PrimaryColumn()
  contentId!: string;

  @PrimaryColumn()
  category!: string;

  @Column({ default: false })
  isPrimary!: boolean; // 주 카테고리 여부

  @Column({ nullable: true })
  subcategory?: string | null; // 세부 카테고리

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  confidence!: number; // AI 분류 신뢰도 (0.0-1.0)

  @Column({ type: 'enum', enum: ['manual', 'ai', 'platform'], default: 'platform' })
  source!: 'manual' | 'ai' | 'platform'; // 카테고리 분류 방식

  @Column({ nullable: true })
  classifiedBy?: string | null; // 분류자 ID (사용자/AI 모델)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
