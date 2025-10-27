import { Injectable } from '@nestjs/common';

import { DataSource, In, LessThan, MoreThan } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorConsentEntity, ConsentType } from '../entities/index.js';

export interface ConsentStats {
  totalConsents: number;
  activeConsents: number;
  expiredConsents: number;
  revokedConsents: number;
}

@Injectable()
export class CreatorConsentRepository extends BaseRepository<CreatorConsentEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorConsentEntity, dataSource);
  }

  // ==================== 배치 처리 조회 메서드 ====================

  /**
   * 여러 크리에이터의 활성 동의 조회 (배치 처리)
   */
  async findActiveByCreatorIds(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    if (creatorIds.length === 0) return {};

    const consents = await this.find({
      where: {
        creatorId: In(creatorIds),
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
      select: ['creatorId', 'type'],
    });

    const consentMap: Record<string, ConsentType[]> = {};

    // 모든 크리에이터에 대해 기본값 설정
    creatorIds.forEach((creatorId) => {
      consentMap[creatorId] = [];
    });

    // 실제 동의 데이터 매핑
    consents.forEach((consent) => {
      const creatorId = consent.creatorId;

      if (!consentMap[creatorId]) {
        consentMap[creatorId] = [];
      }
      consentMap[creatorId].push(consent.type);
    });

    return consentMap;
  }

  /**
   * 여러 크리에이터의 특정 타입 동의 여부 확인 (배치 처리)
   */
  async hasConsentBatch(creatorIds: string[], type: ConsentType): Promise<Record<string, boolean>> {
    if (creatorIds.length === 0) return {};

    const consents = await this.find({
      where: {
        creatorId: In(creatorIds),
        type,
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
      select: ['creatorId'],
    });

    const consentMap: Record<string, boolean> = {};

    // 모든 크리에이터에 대해 기본값 설정
    creatorIds.forEach((creatorId) => {
      consentMap[creatorId] = false;
    });

    // 동의가 있는 크리에이터는 true로 설정
    consents.forEach((consent) => {
      consentMap[consent.creatorId] = true;
    });

    return consentMap;
  }

  // ==================== 복잡한 조건 조회 메서드 ====================

  /**
   * 만료된 동의 조회 (복잡한 날짜 조건)
   */
  async findExpiredConsents(): Promise<CreatorConsentEntity[]> {
    return await this.find({
      where: {
        isGranted: true,
        expiresAt: LessThan(new Date()),
      },
      order: { expiresAt: 'ASC' },
    });
  }

  /**
   * 곧 만료될 동의 조회 (복잡한 날짜 범위 조건)
   */
  async findExpiringConsents(days: number = 7): Promise<CreatorConsentEntity[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);

    return await this.createQueryBuilder('consent')
      .where('consent.isGranted = :isGranted', { isGranted: true })
      .andWhere('consent.expiresAt > :now', { now })
      .andWhere('consent.expiresAt <= :future', { future })
      .orderBy('consent.expiresAt', 'ASC')
      .getMany();
  }

  // ==================== 통계 집계 메서드 ====================

  /**
   * 크리에이터별 동의 통계 집계
   */
  async getStatsByCreatorId(creatorId: string): Promise<ConsentStats> {
    const results = await this.createQueryBuilder('consent')
      .select([
        'COUNT(*) as totalConsents',
        'SUM(CASE WHEN consent.isGranted = true AND consent.expiresAt > NOW() THEN 1 ELSE 0 END) as activeConsents',
        'SUM(CASE WHEN consent.isGranted = true AND consent.expiresAt <= NOW() THEN 1 ELSE 0 END) as expiredConsents',
        'SUM(CASE WHEN consent.isGranted = false AND consent.revokedAt IS NOT NULL THEN 1 ELSE 0 END) as revokedConsents',
      ])
      .where('consent.creatorId = :creatorId', { creatorId })
      .getRawOne();

    return {
      totalConsents: parseInt(results.totalConsents) || 0,
      activeConsents: parseInt(results.activeConsents) || 0,
      expiredConsents: parseInt(results.expiredConsents) || 0,
      revokedConsents: parseInt(results.revokedConsents) || 0,
    };
  }

  /**
   * 동의 타입별 통계 집계
   */
  async getStatsByConsentType(): Promise<Record<ConsentType, number>> {
    const results = await this.createQueryBuilder('consent')
      .select(['consent.type as type', 'COUNT(*) as count'])
      .where('consent.isGranted = :isGranted', { isGranted: true })
      .andWhere('consent.expiresAt > :now', { now: new Date() })
      .groupBy('consent.type')
      .getRawMany();

    const statsMap: Record<ConsentType, number> = {
      [ConsentType.DATA_COLLECTION]: 0,
      [ConsentType.PRIVACY_POLICY]: 0,
      [ConsentType.MARKETING]: 0,
      [ConsentType.ANALYTICS]: 0,
    };

    results.forEach((result) => {
      statsMap[result.type as ConsentType] = parseInt(result.count) || 0;
    });

    return statsMap;
  }
}
