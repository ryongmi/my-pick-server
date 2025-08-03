import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { VideoSyncStatus } from '@common/enums/index.js';

@Injectable()
export class CreatorPlatformSyncRepository extends BaseRepository<CreatorPlatformSyncEntity> {
  constructor() {
    super(CreatorPlatformSyncEntity);
  }

  // ==================== 플랫폼별 동기화 조회 ====================

  /**
   * 플랫폼 ID로 동기화 정보 조회
   */
  async findByPlatformId(platformId: string): Promise<CreatorPlatformSyncEntity | null> {
    return await this.findOne({
      where: { platformId },
    });
  }

  /**
   * 여러 플랫폼 ID로 동기화 정보 배치 조회
   */
  async findByPlatformIds(platformIds: string[]): Promise<CreatorPlatformSyncEntity[]> {
    if (platformIds.length === 0) return [];

    return await this.find({
      where: { platformId: In(platformIds) },
      order: { lastVideoSyncAt: 'DESC' },
    });
  }

  // ==================== 동기화 상태별 조회 ====================

  /**
   * 동기화 상태별 조회
   */
  async findByVideoSyncStatus(status: VideoSyncStatus): Promise<CreatorPlatformSyncEntity[]> {
    return await this.find({
      where: { videoSyncStatus: status },
      order: { lastVideoSyncAt: 'DESC' },
    });
  }

  /**
   * 진행 중인 동기화 작업 조회
   */
  async findInProgressSyncs(): Promise<CreatorPlatformSyncEntity[]> {
    return await this.findByVideoSyncStatus(VideoSyncStatus.IN_PROGRESS);
  }

  /**
   * 실패한 동기화 작업 조회
   */
  async findFailedSyncs(): Promise<CreatorPlatformSyncEntity[]> {
    return await this.findByVideoSyncStatus(VideoSyncStatus.FAILED);
  }

  /**
   * 한 번도 동기화되지 않은 플랫폼 조회
   */
  async findNeverSyncedPlatforms(): Promise<CreatorPlatformSyncEntity[]> {
    return await this.findByVideoSyncStatus(VideoSyncStatus.NEVER_SYNCED);
  }

  // ==================== 시간 기반 조회 ====================

  /**
   * 마지막 동기화 이후 경과 시간이 지정된 시간보다 긴 플랫폼 조회
   */
  async findStaleSync(hoursAgo: number): Promise<CreatorPlatformSyncEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    return await this.createQueryBuilder('sync')
      .where('sync.lastVideoSyncAt < :cutoffDate', { cutoffDate })
      .orWhere('sync.lastVideoSyncAt IS NULL')
      .orderBy('sync.lastVideoSyncAt', 'ASC')
      .getMany();
  }

  /**
   * 동기화 진행률별 조회 (헬퍼 메서드 활용)
   */
  async findByProgressRange(minProgress: number, maxProgress: number): Promise<CreatorPlatformSyncEntity[]> {
    const syncs = await this.find({
      where: {
        videoSyncStatus: In([VideoSyncStatus.IN_PROGRESS, VideoSyncStatus.COMPLETED]),
      },
    });

    return syncs.filter(sync => {
      const progress = sync.getSyncProgress();
      return progress >= minProgress && progress <= maxProgress;
    });
  }

  // ==================== 통계 조회 ====================

  /**
   * 동기화 상태별 개수 조회
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

    result.forEach(row => {
      counts[row.status as VideoSyncStatus] = parseInt(row.count, 10);
    });

    return counts;
  }

  /**
   * 전체 동기화 진행률 통계
   */
  async getSyncProgressStats(): Promise<{
    totalPlatforms: number;
    totalVideos: number;
    syncedVideos: number;
    failedVideos: number;
    overallProgress: number;
    overallSuccessRate: number;
  }> {
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
    const overallSuccessRate = totalAttempted > 0 ? Math.round((syncedVideos / totalAttempted) * 100) : 0;

    return {
      totalPlatforms,
      totalVideos,
      syncedVideos,
      failedVideos,
      overallProgress,
      overallSuccessRate,
    };
  }
}