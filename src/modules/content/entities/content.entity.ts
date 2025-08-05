import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

@Entity('content')
@Index(['creatorId']) // 크리에이터별 콘텐츠 조회 최적화
@Index(['platform']) // 플랫폼별 조회 최적화
@Index(['publishedAt']) // 발행일 기준 정렬 최적화
@Index(['platform', 'publishedAt']) // 플랫폼별 최신순 조회 최적화
@Index(['creatorId', 'publishedAt']) // 크리에이터별 최신 콘텐츠 조회 최적화
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

  // FK 없이 contentId로 ContentStatisticsEntity와 연결

  // 메타데이터와 모더레이션 정보는 별도 엔티티로 분리됨
  // - ContentMetadataEntity (1:1)
  // - ContentModerationEntity (1:1)
  // - ContentStatisticsEntity (1:1)
  // - ContentSyncEntity (1:1)
}
