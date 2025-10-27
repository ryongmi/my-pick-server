import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

// JSON 필드 타입 정의
export interface CreatorProfile {
  displayName?: string; // 표시용 이름 (커스터마이징 가능)
  bio?: string; // 짧은 소개 (description과 별도)
  profileImages?: {
    thumbnail?: string; // 작은 프로필 (88x88)
    medium?: string; // 중간 프로필 (240x240)
    high?: string; // 큰 프로필 (800x800)
  };
  bannerImageUrl?: string; // 배너 이미지
  customUrl?: string; // 커스텀 URL (@채널명)
  country?: string; // 국가 코드 (KR, US)
  keywords?: string[]; // 키워드/태그
}

export interface CreatorStatistics {
  totalSubscribers: number; // 총 구독자 수
  totalVideos: number; // 총 영상 수
  totalViews: number; // 총 조회수
  averageViews?: number; // 평균 조회수
  engagementRate?: number; // 참여율 (%)
  lastUpdatedAt: string; // 마지막 업데이트 (ISO 8601)
}

export interface CreatorMetadata {
  platformCreatedAt?: string; // 플랫폼 계정 생성일 (ISO 8601)
  firstSyncedAt?: string; // 최초 동기화 일시
  lastSyncedAt?: string; // 마지막 동기화 일시
  applicationId?: string; // 생성된 신청 ID (추적용)
  verifiedAt?: string; // 인증 완료 일시
  tags?: string[]; // 시스템 태그 (예: 'trending', 'verified')
}

@Entity('creators')
@Index(['name'])
@Index(['isActive'])
@Index(['userId'])
export class CreatorEntity extends BaseEntityUUID {
  // ==================== 기본 정보 ====================

  @Column()
  userId!: string; // 이 크리에이터를 소유한 사용자 ID (필수)

  @Column()
  name!: string; // 크리에이터 이름 (필수, 검색용)

  @Column({ type: 'text', nullable: true })
  description?: string; // 크리에이터 소개 (상세 설명)

  @Column({ nullable: true })
  profileImageUrl?: string; // 대표 프로필 이미지 URL (하위 호환)

  // ==================== 프로필 정보 (JSON) ====================

  @Column({ type: 'json', nullable: true })
  profile?: CreatorProfile; // 확장 프로필 정보

  // ==================== 통계 정보 (JSON) ====================

  @Column({ type: 'json', nullable: true })
  statistics?: CreatorStatistics; // 채널 통계

  // ==================== 메타데이터 (JSON) ====================

  @Column({ type: 'json', nullable: true })
  metadata?: CreatorMetadata; // 시스템 메타데이터

  // ==================== 시스템 상태 ====================

  @Column({ default: true })
  isActive!: boolean; // 활성화 상태
}
