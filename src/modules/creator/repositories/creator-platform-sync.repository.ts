import { Injectable } from '@nestjs/common';

import { DataSource, In, LessThan, MoreThan } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorPlatformSyncEntity } from '../entities/index.js';

export interface SyncStats {
  totalPlatforms: number;
  totalVideos: number;
  syncedVideos: number;
  failedVideos: number;
  overallProgress: number;
  overallSuccessRate: number;
}

@Injectable()
export class CreatorPlatformSyncRepository extends BaseRepository<CreatorPlatformSyncEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformSyncEntity, dataSource);
  }

  // ==================== 배치 처리 조회 메서드 ====================

  /**
   * 여러 플랫폼 ID로 동기화 정보 배치 조회 (Record 형태 반환)
   */
  async findByPlatformIds(
    platformIds: string[]
  ): Promise<Record<string, CreatorPlatformSyncEntity>> {
    if (platformIds.length === 0) return {};

    const syncs = await this.find({
      where: { platformId: In(platformIds) },
      order: { lastVideoSyncAt: 'DESC' },
    });

    const syncMap: Record<string, CreatorPlatformSyncEntity> = {};

    // 모든 플랫폼에 대해 기본값 설정
    platformIds.forEach((platformId) => {
      syncMap[platformId] = null as any; // null로 초기화하여 동기화 정보가 없음을 표시
    });

    // 실제 동기화 데이터 매핑
    syncs.forEach((sync) => {
      syncMap[sync.platformId] = sync;
    });

    return syncMap;
  }

  // ==================== 복잡한 조건 조회 메서드 ====================

  /**
   * 동기화 상태별 조회 (복잡한 조건)
   */
  async findByVideoSyncStatus(status: VideoSyncStatus): Promise<CreatorPlatformSyncEntity[]> {
    return await this.find({
      where: { videoSyncStatus: status },
      order: { lastVideoSyncAt: 'DESC' },
    });
  }

  /**
   * 진행 중인 동기화 작업 조회 (긴급 모니터링용)
   */
  async findInProgressSyncs(): Promise<CreatorPlatformSyncEntity[]> {
    return await this.createQueryBuilder('sync')
      .where('sync.videoSyncStatus = :status', { status: VideoSyncStatus.IN_PROGRESS })
      .andWhere('sync.syncStartedAt IS NOT NULL')
      .orderBy('sync.syncStartedAt', 'ASC') // 오래된 것부터 (timeout 체크용)
      .getMany();
  }

  /**
   * 실패한 동기화 작업 조회 (재시도 대상)
   */
  async findFailedSyncs(hoursAgo?: number): Promise<CreatorPlatformSyncEntity[]> {
    const query = this.createQueryBuilder('sync').where('sync.videoSyncStatus = :status', {
      status: VideoSyncStatus.FAILED,
    });

    if (hoursAgo) {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);
      query.andWhere('sync.lastVideoSyncAt >= :cutoffDate', { cutoffDate });
    }

    return await query.orderBy('sync.lastVideoSyncAt', 'DESC').getMany();
  }

  /**
   * 한 번도 동기화되지 않은 플랫폼 조회 (초기 동기화 대상)
   */
  async findNeverSyncedPlatforms(): Promise<CreatorPlatformSyncEntity[]> {
    return await this.find({
      where: { videoSyncStatus: VideoSyncStatus.NEVER_SYNCED },
      order: { createdAt: 'ASC' }, // 오래된 것부터 우선 처리
    });
  }

  /**
   * 마지막 동기화 이후 경과 시간이 지정된 시간보다 긴 플랫폼 조회 (재동기화 대상)
   */
  async findStaleSync(hoursAgo: number): Promise<CreatorPlatformSyncEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    return await this.createQueryBuilder('sync')
      .where('sync.lastVideoSyncAt < :cutoffDate', { cutoffDate })
      .orWhere('sync.lastVideoSyncAt IS NULL')
      .orderBy('sync.lastVideoSyncAt', 'ASC', 'NULLS FIRST') // null 값을 먼저 처리
      .getMany();
  }

  /**
   * 긴급 타임아웃 체크 - 진행 중이지만 너무 오래 걸리는 동기화 작업 조회
   */
  async findTimeoutSyncs(timeoutHours: number = 2): Promise<CreatorPlatformSyncEntity[]> {
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - timeoutHours);

    return await this.createQueryBuilder('sync')
      .where('sync.videoSyncStatus = :status', { status: VideoSyncStatus.IN_PROGRESS })
      .andWhere('sync.syncStartedAt < :timeoutDate', { timeoutDate })
      .orderBy('sync.syncStartedAt', 'ASC')
      .getMany();
  }

  /**
   * 동기화 진행률별 조회 (모니터링용 복잡한 조건)
   */
  async findByProgressRange(
    minProgress: number,
    maxProgress: number
  ): Promise<CreatorPlatformSyncEntity[]> {
    // DB에서 계산 가능한 경우는 쿼리로 처리, 그렇지 않으면 애플리케이션에서 필터링
    const syncs = await this.createQueryBuilder('sync')
      .where('sync.videoSyncStatus IN (:...statuses)', {
        statuses: [VideoSyncStatus.IN_PROGRESS, VideoSyncStatus.COMPLETED],
      })
      .andWhere('sync.totalVideoCount > 0') // 진행률 계산 가능한 것만
      .orderBy('sync.lastVideoSyncAt', 'DESC')
      .getMany();

    return syncs.filter((sync) => {
      const progress = sync.getSyncProgress();
      return progress >= minProgress && progress <= maxProgress;
    });
  }

  // ==================== 통계 집계 메서드 ====================

  /**
   * 동기화 상태별 개수 조회 (관리자 대시보드용)
   */
  async getStatusCounts(): Promise<Record<VideoSyncStatus, number>> {
    const result = await this.createQueryBuilder('sync')
      .select('sync.videoSyncStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sync.videoSyncStatus')
      .getRawMany();

    const counts: Record<VideoSyncStatus, number> = {
      [VideoSyncStatus.NEVER_SYNCED]: 0,
      [VideoSyncStatus.IN_PROGRESS]: 0,
      [VideoSyncStatus.COMPLETED]: 0,
      [VideoSyncStatus.FAILED]: 0,
    };

    result.forEach((row) => {
      counts[row.status as VideoSyncStatus] = parseInt(row.count, 10);
    });

    return counts;
  }

  /**
   * 전체 동기화 진행률 통계 (시스템 모니터링용)
   */
  async getSyncProgressStats(): Promise<SyncStats> {
    const result = await this.createQueryBuilder('sync')
      .select([
        'COUNT(*) as totalPlatforms',
        'COALESCE(SUM(sync.totalVideoCount), 0) as totalVideos',
        'COALESCE(SUM(sync.syncedVideoCount), 0) as syncedVideos',
        'COALESCE(SUM(sync.failedVideoCount), 0) as failedVideos',
      ])
      .getRawOne();

    const totalPlatforms = parseInt(result.totalPlatforms, 10);
    const totalVideos = parseInt(result.totalVideos, 10);
    const syncedVideos = parseInt(result.syncedVideos, 10);
    const failedVideos = parseInt(result.failedVideos, 10);

    const overallProgress = totalVideos > 0 ? Math.round((syncedVideos / totalVideos) * 100) : 0;
    const totalAttempted = syncedVideos + failedVideos;
    const overallSuccessRate =
      totalAttempted > 0 ? Math.round((syncedVideos / totalAttempted) * 100) : 0;

    return {
      totalPlatforms,
      totalVideos,
      syncedVideos,
      failedVideos,
      overallProgress,
      overallSuccessRate,
    };
  }

  /**
   * 플랫폼별 동기화 통계 조회 (배치 처리)
   */
  async getStatsByPlatformIds(platformIds: string[]): Promise<Record<string, SyncStats>> {
    if (platformIds.length === 0) return {};

    const result = await this.createQueryBuilder('sync')
      .select([
        'sync.platformId as platformId',
        'COALESCE(sync.totalVideoCount, 0) as totalVideos',
        'COALESCE(sync.syncedVideoCount, 0) as syncedVideos',
        'COALESCE(sync.failedVideoCount, 0) as failedVideos',
      ])
      .where('sync.platformId IN (:...platformIds)', { platformIds })
      .getRawMany();

    const statsMap: Record<string, SyncStats> = {};

    // 모든 플랫폼에 대해 기본값 설정
    platformIds.forEach((platformId) => {
      statsMap[platformId] = {
        totalPlatforms: 1,
        totalVideos: 0,
        syncedVideos: 0,
        failedVideos: 0,
        overallProgress: 0,
        overallSuccessRate: 0,
      };
    });

    // 실제 통계 데이터 매핑
    result.forEach((row) => {
      const totalVideos = parseInt(row.totalVideos, 10);
      const syncedVideos = parseInt(row.syncedVideos, 10);
      const failedVideos = parseInt(row.failedVideos, 10);
      const totalAttempted = syncedVideos + failedVideos;

      statsMap[row.platformId] = {
        totalPlatforms: 1,
        totalVideos,
        syncedVideos,
        failedVideos,
        overallProgress: totalVideos > 0 ? Math.round((syncedVideos / totalVideos) * 100) : 0,
        overallSuccessRate:
          totalAttempted > 0 ? Math.round((syncedVideos / totalAttempted) * 100) : 0,
      };
    });

    return statsMap;
  }
}
