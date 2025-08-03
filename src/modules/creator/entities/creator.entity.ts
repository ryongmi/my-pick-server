import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity('creators')
@Index(['category']) // 카테고리별 조회 최적화
@Index(['isVerified', 'category']) // 인증된 크리에이터 조회 최적화
export class CreatorEntity extends BaseEntityUUID {
  @Column({ nullable: true })
  userId?: string; // auth-server에서 관리하는 사용자 ID (선택적)

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
}

