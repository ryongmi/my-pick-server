import { Injectable } from '@nestjs/common';

import { DataSource, In } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { PlatformType } from '@common/enums/index.js';

import { CreatorPlatformEntity } from '../entities/index.js';

export interface PlatformStats {
  totalFollowers: number;
  totalContent: number;
  totalViews: number;
  platformCount: number;
}

@Injectable()
export class CreatorPlatformRepository extends BaseRepository<CreatorPlatformEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformEntity, dataSource);
  }

  // ==================== 배치 처리 조회 메서드 ====================

  /**
   * 여러 크리에이터의 플랫폼 목록 조회 (배치 처리)
   */
  async findByCreatorIds(creatorIds: string[]): Promise<Record<string, CreatorPlatformEntity[]>> {
    if (creatorIds.length === 0) return {};

    const platforms = await this.find({
      where: { creatorId: In(creatorIds) },
      order: { createdAt: 'DESC' },
    });

    const platformMap: Record<string, CreatorPlatformEntity[]> = {};

    creatorIds.forEach((creatorId) => {
      platformMap[creatorId] = [];
    });

    platforms.forEach((platform) => {
      const creatorId = platform.creatorId;

      if (!platformMap[creatorId]) {
        platformMap[creatorId] = [];
      }
      platformMap[creatorId].push(platform);
    });

    return platformMap;
  }

  /**
   * 여러 크리에이터의 활성 플랫폼 조회 (배치 처리)
   */
  async findActiveByCreatorIds(
    creatorIds: string[]
  ): Promise<Record<string, CreatorPlatformEntity[]>> {
    if (creatorIds.length === 0) return {};

    const platforms = await this.find({
      where: { creatorId: In(creatorIds), isActive: true },
      order: { createdAt: 'DESC' },
    });

    const platformMap: Record<string, CreatorPlatformEntity[]> = {};

    creatorIds.forEach((creatorId) => {
      platformMap[creatorId] = [];
    });

    platforms.forEach((platform) => {
      const creatorId = platform.creatorId;

      if (!platformMap[creatorId]) {
        platformMap[creatorId] = [];
      }
      platformMap[creatorId].push(platform);
    });

    return platformMap;
  }

  // ==================== 통계 집계 메서드 ====================

  /**
   * 크리에이터별 플랫폼 통계 집계
   */
  async getStatsByCreatorId(creatorId: string): Promise<PlatformStats> {
    const result = await this.createQueryBuilder('platform')
      .select([
        'SUM(platform.followerCount) as totalFollowers',
        'SUM(platform.contentCount) as totalContent',
        'SUM(platform.totalViews) as totalViews',
        'COUNT(platform.id) as platformCount',
      ])
      .where('platform.creatorId = :creatorId', { creatorId })
      .andWhere('platform.isActive = :isActive', { isActive: true })
      .getRawOne();

    return {
      totalFollowers: parseInt(result.totalFollowers) || 0,
      totalContent: parseInt(result.totalContent) || 0,
      totalViews: parseInt(result.totalViews) || 0,
      platformCount: parseInt(result.platformCount) || 0,
    };
  }

  /**
   * 여러 크리에이터의 플랫폼 통계 집계 (배치 처리)
   */
  async getStatsByCreatorIds(creatorIds: string[]): Promise<Record<string, PlatformStats>> {
    if (creatorIds.length === 0) return {};

    const results = await this.createQueryBuilder('platform')
      .select([
        'platform.creatorId as creatorId',
        'SUM(platform.followerCount) as totalFollowers',
        'SUM(platform.contentCount) as totalContent',
        'SUM(platform.totalViews) as totalViews',
        'COUNT(platform.id) as platformCount',
      ])
      .where('platform.creatorId IN (:...creatorIds)', { creatorIds })
      .andWhere('platform.isActive = :isActive', { isActive: true })
      .groupBy('platform.creatorId')
      .getRawMany();

    const statsMap: Record<string, PlatformStats> = {};

    // 모든 크리에이터에 대해 기본값 설정
    creatorIds.forEach((creatorId) => {
      statsMap[creatorId] = {
        totalFollowers: 0,
        totalContent: 0,
        totalViews: 0,
        platformCount: 0,
      };
    });

    // 실제 데이터로 업데이트
    results.forEach((result) => {
      statsMap[result.creatorId] = {
        totalFollowers: parseInt(result.totalFollowers) || 0,
        totalContent: parseInt(result.totalContent) || 0,
        totalViews: parseInt(result.totalViews) || 0,
        platformCount: parseInt(result.platformCount) || 0,
      };
    });

    return statsMap;
  }
}
