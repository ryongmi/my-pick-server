import { Injectable } from '@nestjs/common';
import { Repository, DataSource, MoreThan, LessThan } from 'typeorm';

import { CreatorConsentEntity, ConsentType } from '../entities/creator-consent.entity.js';

@Injectable()
export class CreatorConsentRepository extends Repository<CreatorConsentEntity> {
  constructor(dataSource: DataSource) {
    super(CreatorConsentEntity, dataSource.createEntityManager());
  }

  /**
   * 크리에이터의 유효한 동의 조회
   */
  async findActiveConsents(creatorId: string): Promise<CreatorConsentEntity[]> {
    return this.find({
      where: {
        creatorId,
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 특정 동의 타입의 유효한 동의 조회
   */
  async findActiveConsentByType(
    creatorId: string,
    type: ConsentType
  ): Promise<CreatorConsentEntity | null> {
    return this.findOne({
      where: {
        creatorId,
        type,
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 크리에이터의 동의 이력 조회
   */
  async findConsentHistory(
    creatorId: string,
    type?: ConsentType
  ): Promise<CreatorConsentEntity[]> {
    const whereCondition: any = { creatorId };
    if (type) {
      whereCondition.type = type;
    }

    return this.find({
      where: whereCondition,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 만료된 동의 조회
   */
  async findExpiredConsents(): Promise<CreatorConsentEntity[]> {
    return this.find({
      where: {
        isGranted: true,
        expiresAt: LessThan(new Date()),
      },
      order: {
        expiresAt: 'ASC',
      },
    });
  }

  /**
   * 특정 크리에이터의 만료 임박 동의 조회 (7일 이내)
   */
  async findSoonToExpireConsents(creatorId: string): Promise<CreatorConsentEntity[]> {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return this.find({
      where: {
        creatorId,
        isGranted: true,
        expiresAt: LessThan(sevenDaysFromNow),
      },
      order: {
        expiresAt: 'ASC',
      },
    });
  }

  /**
   * 동의 현황 통계
   */
  async getConsentStatistics(): Promise<Array<{
    type: ConsentType;
    totalCount: number;
    activeCount: number;
    expiredCount: number;
  }>> {
    return this.createQueryBuilder('consent')
      .select('consent.type', 'type')
      .addSelect('COUNT(consent.id)', 'totalCount')
      .addSelect('SUM(CASE WHEN consent.isGranted = 1 AND (consent.expiresAt IS NULL OR consent.expiresAt > NOW()) THEN 1 ELSE 0 END)', 'activeCount')
      .addSelect('SUM(CASE WHEN consent.isGranted = 1 AND consent.expiresAt <= NOW() THEN 1 ELSE 0 END)', 'expiredCount')
      .groupBy('consent.type')
      .getRawMany();
  }
}