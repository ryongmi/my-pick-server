import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

export enum ConsentType {
  DATA_COLLECTION = 'data_collection',
  PRIVACY_POLICY = 'privacy_policy',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
}

@Entity('creator_consents')
@Index(['creatorId']) // 크리에이터별 동의 조회 최적화
@Index(['creatorId', 'type']) // 크리에이터별 특정 동의 타입 조회 최적화
@Index(['creatorId', 'isGranted']) // 크리에이터별 동의 상태 조회 최적화
@Index(['expiresAt']) // 만료일 기준 조회 최적화
export class CreatorConsentEntity extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  creatorId!: string;

  @Column({ type: 'enum', enum: ConsentType })
  type!: ConsentType;

  @Column({ default: false })
  isGranted!: boolean;

  @Column()
  grantedAt!: Date;

  @Column({ nullable: true })
  revokedAt?: Date; // 동의 철회 시점

  @Column({ nullable: true })
  expiresAt?: Date; // 동의 만료 시점 (재확인 필요)

  @Column({ type: 'text', nullable: true })
  consentData?: string; // 동의 시점의 추가 정보 (IP, User-Agent 등)

  @Column({ nullable: true })
  version?: string; // 동의한 약관/정책 버전
}
