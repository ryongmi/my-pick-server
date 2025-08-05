import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { VideoSyncStatus } from '@common/enums/index.js';

@Entity('creator_platform_syncs')
@Index(['videoSyncStatus']) // 동기화 상태별 조회 최적화
@Index(['lastVideoSyncAt']) // 마지막 동기화 시점 기준 조회 최적화
@Index(['videoSyncStatus', 'lastVideoSyncAt']) // 복합 인덱스 (상태 + 시점)
export class CreatorPlatformSyncEntity {
  @PrimaryColumn('uuid', { comment: '플랫폼 ID (1:1 관계 부모 PK 사용)' })
  platformId!: string; // CreatorPlatformEntity의 ID와 동일

  // ==================== 영상 동기화 상태 ====================

  @Column({ type: 'enum', enum: VideoSyncStatus, default: VideoSyncStatus.NEVER_SYNCED })
  videoSyncStatus!: VideoSyncStatus;

  @Column({ nullable: true })
  lastVideoSyncAt?: Date; // 마지막 영상 동기화 시점

  @Column({ nullable: true })
  syncStartedAt?: Date; // 동기화 시작 시점

  @Column({ nullable: true })
  syncCompletedAt?: Date; // 동기화 완료 시점

  // ==================== 영상 동기화 진행률 ====================

  @Column({ nullable: true })
  totalVideoCount?: number; // 채널 총 영상 수 (진행률 계산용)

  @Column({ nullable: true })
  syncedVideoCount?: number; // 동기화된 영상 수

  @Column({ nullable: true })
  failedVideoCount?: number; // 동기화 실패한 영상 수

  // ==================== 오류 및 메타데이터 ====================

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string; // 마지막 동기화 에러 메시지

  @Column({ type: 'text', nullable: true })
  syncMetadata?: string; // JSON 형태의 추가 메타데이터 (외부 API 응답, 설정 등)

  // ==================== 타임스탬프 ====================

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ==================== 헬퍼 메서드 ====================

  /**
   * 동기화 진행률 계산 (0-100)
   */
  getSyncProgress(): number {
    if (!this.totalVideoCount || this.totalVideoCount === 0) {
      return 0;
    }
    const syncedCount = this.syncedVideoCount || 0;
    return Math.round((syncedCount / this.totalVideoCount) * 100);
  }

  /**
   * 동기화 성공률 계산 (0-100)
   */
  getSyncSuccessRate(): number {
    const syncedCount = this.syncedVideoCount || 0;
    const failedCount = this.failedVideoCount || 0;
    const totalAttempted = syncedCount + failedCount;

    if (totalAttempted === 0) {
      return 0;
    }

    return Math.round((syncedCount / totalAttempted) * 100);
  }

  /**
   * 동기화가 진행 중인지 확인
   */
  isInProgress(): boolean {
    return this.videoSyncStatus === VideoSyncStatus.IN_PROGRESS;
  }

  /**
   * 동기화가 완료되었는지 확인
   */
  isCompleted(): boolean {
    return this.videoSyncStatus === VideoSyncStatus.COMPLETED;
  }

  /**
   * 동기화에 실패했는지 확인
   */
  isFailed(): boolean {
    return this.videoSyncStatus === VideoSyncStatus.FAILED;
  }
}