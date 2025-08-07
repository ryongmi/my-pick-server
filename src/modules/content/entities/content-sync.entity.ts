import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_sync')
@Index(['expiresAt']) // 만료 데이터 정리 최적화
@Index(['isAuthorizedData', 'expiresAt']) // 인증 데이터 관리 최적화
@Index(['lastSyncedAt']) // 동기화 시간 기준 조회 최적화
@Index(['syncStatus']) // 동기화 상태별 조회 최적화
@Index(['nextSyncAt']) // 다음 동기화 예정 시간 조회 최적화
export class ContentSyncEntity {
  @PrimaryColumn({ comment: '외래키(content.id)이자 기본키 - 1:1 관계 최적화' })
  contentId!: string; // ContentEntity와 1:1 관계

  @Column({ nullable: true })
  lastSyncedAt?: Date; // 마지막 동기화 시간

  @Column({ nullable: true })
  expiresAt?: Date; // 데이터 만료 시간 (YouTube API 30일 정책)

  @Column({ default: false })
  isAuthorizedData?: boolean; // 인증된 데이터 여부 (크리에이터 동의 기반)

  @Column({ nullable: true })
  syncError?: string; // 동기화 오류 메시지

  @Column({ default: 0 })
  syncRetryCount?: number; // 동기화 재시도 횟수

  @Column({ nullable: true })
  nextSyncAt?: Date; // 다음 동기화 예정 시간

  @Column({
    type: 'enum',
    enum: ['pending', 'syncing', 'completed', 'failed'],
    default: 'completed',
  })
  syncStatus!: 'pending' | 'syncing' | 'completed' | 'failed';


  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // FK 없이 contentId 저장해서 직접 조회
}
