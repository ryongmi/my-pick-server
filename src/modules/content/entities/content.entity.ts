import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

@Entity('content')
@Index(['creatorId'])
@Index(['platform', 'platformId'], { unique: true })
@Index(['publishedAt'])
@Index(['creatorId', 'publishedAt'])
@Index(['platform', 'publishedAt'])
@Index(['isLive'])
@Index(['ageRestriction'])
@Index(['language'])
@Index(['quality'])
@Index(['language', 'quality'])
@Index(['isLive', 'ageRestriction'])
export class ContentEntity extends BaseEntityUUID {
  @Column({ type: 'enum', enum: ContentType })
  type!: ContentType;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  thumbnail!: string;

  @Column()
  url!: string;

  @Column({ type: 'enum', enum: PlatformType })
  platform!: PlatformType;

  @Column()
  platformId!: string;

  @Column({ nullable: true })
  duration?: number;

  @Column()
  publishedAt!: Date;

  @Column()
  creatorId!: string; // FK 없이 creatorId 저장해서 직접 조회

  // ==================== 메타데이터 (JSON에서 개별 컬럼으로 분리) ====================
  // tags, category는 별도 엔티티(ContentTagEntity, ContentCategoryEntity)로 분리됨

  @Column({ nullable: true, comment: '콘텐츠 언어 (ISO 639-1)' })
  language?: string;

  @Column({ default: false, comment: '실시간 방송 여부' })
  isLive!: boolean;

  @Column({
    type: 'enum',
    enum: ['sd', 'hd', '4k'],
    nullable: true,
    comment: '영상 품질',
  })
  quality?: 'sd' | 'hd' | '4k';

  @Column({ default: false, comment: '연령 제한 콘텐츠 여부' })
  ageRestriction!: boolean;
}
