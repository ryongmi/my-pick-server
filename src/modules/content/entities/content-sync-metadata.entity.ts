import { Entity, PrimaryColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_sync_metadata')
@Index(['updatedAt']) // 최근 업데이트 기준 조회 최적화
export class ContentSyncMetadataEntity {
  @PrimaryColumn({ comment: '콘텐츠 ID (1:1 관계)' })
  contentId!: string;

  @Column('int', { default: 0, comment: 'API 호출 횟수' })
  apiCallCount!: number;

  @Column('int', { default: 0, comment: '사용된 API 쿼터' })
  quotaUsed!: number;

  @Column({ nullable: true, comment: '쿼터 리셋 시간' })
  lastQuotaReset?: Date;

  @Column('int', { nullable: true, comment: '동기화 소요 시간 (ms)' })
  syncDuration?: number;

  @Column({ nullable: true, comment: '데이터 버전' })
  dataVersion?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}