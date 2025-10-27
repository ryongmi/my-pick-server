import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ApplicationStatus } from '../enums/index.js';

// Re-export ApplicationStatus for external use
export { ApplicationStatus };

export enum PlatformType {
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
}

// JSON 필드 타입 정의
export interface ChannelInfo {
  platform: PlatformType;
  channelId: string; // 플랫폼 채널 ID
  channelUrl: string; // 채널 URL
  channelName: string; // 채널 이름
  subscriberCount?: number; // 구독자 수 (신청 시점)
  videoCount?: number; // 영상 수
  description?: string; // 채널 설명
  thumbnailUrl?: string; // 썸네일
  customUrl?: string; // 커스텀 URL
  country?: string; // 국가
  publishedAt?: string; // 채널 생성일 (ISO 8601)
}

export interface ReviewInfo {
  reviewerId?: string; // 검토자 ID
  reviewedAt?: string; // 검토 완료 시간 (ISO 8601)
  reason?: string; // 거부 사유
  comment?: string; // 검토 코멘트
}

@Entity('creator_applications')
@Index(['userId'])
@Index(['status'])
@Index(['appliedAt'])
export class CreatorApplicationEntity extends BaseEntityUUID {
  // ==================== 신청자 정보 ====================

  @Column({ type: 'uuid' })
  userId!: string; // 신청자 ID (auth-server User.id)

  // ==================== 채널 정보 (JSON) ====================

  @Column({ type: 'json' })
  channelInfo!: ChannelInfo;

  // ==================== 신청 상태 ====================

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status!: ApplicationStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  appliedAt!: Date;

  // ==================== 신청자 메시지 ====================

  @Column({ type: 'text', nullable: true })
  applicantMessage?: string; // 신청 사유/소개

  // ==================== 검토 정보 (JSON) ====================

  @Column({ type: 'json', nullable: true })
  reviewInfo?: ReviewInfo;
}
