import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity('creators')
@Index(['category']) // 카테고리별 조회 최적화
@Index(['isVerified', 'category']) // 인증된 크리에이터 조회 최적화
@Index(['status']) // 상태별 조회 최적화
@Index(['verificationStatus']) // 검증 상태별 조회 최적화
@Index(['status', 'category']) // 상태+카테고리 조합 조회 최적화
export class CreatorEntity extends BaseEntityUUID {
  @Column({ nullable: true })
  userId?: string | null; // auth-server에서 관리하는 사용자 ID (선택적)

  @Column()
  name!: string;

  @Column()
  displayName!: string;

  @Column({ nullable: true })
  avatar?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ default: false })
  isVerified!: boolean;

  @Column()
  category!: string;

  @Column('simple-array', { nullable: true })
  tags?: string[] | null;

  // ==================== 새로 추가된 필드들 ====================

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended', 'banned'],
    default: 'active',
    comment: '크리에이터 활동 상태',
  })
  status!: 'active' | 'inactive' | 'suspended' | 'banned';

  @Column({
    type: 'enum',
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
    comment: '검증 상태',
  })
  verificationStatus!: 'pending' | 'verified' | 'rejected';

  @Column({
    nullable: true,
    comment: '마지막 활동 시간',
  })
  lastActivityAt?: Date;

  @Column({
    type: 'json',
    nullable: true,
    comment: '소셜 미디어 링크',
  })
  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    discord?: string;
    youtube?: string;
  };

  // 통계 정보는 별도 엔티티로 분리 예정
  // - CreatorStatisticsEntity (1:1) - 통계 정보
}
