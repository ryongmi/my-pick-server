import { Entity, Column } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity('creators')
export class CreatorEntity extends BaseEntityUUID {
  @Column({ nullable: true })
  userId?: string;

  @Column()
  name!: string;

  @Column()
  displayName!: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: false })
  isVerified!: boolean;

  @Column()
  category!: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  // ==================== 데이터 수집 동의 관리 ====================
  
  @Column({ default: false })
  hasDataConsent!: boolean; // 데이터 수집 동의 여부

  @Column({ nullable: true })
  consentGrantedAt?: Date; // 동의 시점

  @Column({ nullable: true })
  consentExpiresAt?: Date; // 동의 만료 시점 (재확인 필요)

  @Column({ nullable: true })
  lastConsentCheckAt?: Date; // 마지막 동의 상태 확인
}

