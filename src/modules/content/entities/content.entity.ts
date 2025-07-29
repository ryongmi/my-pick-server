import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

export enum ContentType {
  YOUTUBE_VIDEO = 'youtube_video',
  TWITTER_POST = 'twitter_post',
  INSTAGRAM_POST = 'instagram_post',
  TIKTOK_VIDEO = 'tiktok_video',
}

export interface ContentMetadata {
  tags: string[];
  category: string;
  language: string;
  isLive: boolean;
  quality: 'sd' | 'hd' | '4k';
  ageRestriction?: boolean;
}

@Entity('content')
export class ContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ContentType })
  type: ContentType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  thumbnail: string;

  @Column()
  url: string;

  @Column({ type: 'enum', enum: PlatformType })
  platform: PlatformType;

  @Column()
  platformId: string;

  @Column({ nullable: true })
  duration?: number;

  @Column()
  publishedAt: Date;

  @Column()
  creatorId: string; // FK 없이 creatorId 저장해서 직접 조회

  // FK 없이 contentId로 ContentStatisticsEntity와 연결

  @Column({ type: 'json' })
  metadata: ContentMetadata;

  @Column({ nullable: true })
  lastSyncedAt?: Date; // 마지막 동기화 시간

  @Column({ nullable: true })
  expiresAt?: Date; // 데이터 만료 시간 (YouTube API 30일 정책)

  @Column({ default: false })
  isAuthorizedData?: boolean; // 인증된 데이터 여부 (크리에이터 동의 기반)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
