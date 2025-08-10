import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, MoreThan } from 'typeorm';

import { CreatorConsentRepository, type ConsentStats } from '../repositories/index.js';
import { CreatorConsentEntity, ConsentType } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorConsentService {
  private readonly logger = new Logger(CreatorConsentService.name);

  constructor(private readonly consentRepo: CreatorConsentRepository) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들 (BaseRepository 직접 사용)

  /**
   * 크리에이터의 활성 동의 타입 목록 조회
   */
  async getActiveConsents(creatorId: string): Promise<ConsentType[]> {
    try {
      const consents = await this.consentRepo.find({
        where: {
          creatorId,
          isGranted: true,
          expiresAt: MoreThan(new Date()),
        },
        select: ['type'],
      });
      return consents.map((c) => c.type);
    } catch (error: unknown) {
      this.logger.error('Active consents fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 특정 동의 타입 존재 확인
   */
  async hasConsent(creatorId: string, type: ConsentType): Promise<boolean> {
    try {
      const consent = await this.consentRepo.findOne({
        where: {
          creatorId,
          type,
          isGranted: true,
          expiresAt: MoreThan(new Date()),
        },
      });
      return !!consent;
    } catch (error: unknown) {
      this.logger.error('Consent existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 크리에이터의 활성 동의 존재 확인
   */
  async hasAnyConsent(creatorId: string): Promise<boolean> {
    try {
      const count = await this.consentRepo.count({
        where: {
          creatorId,
          isGranted: true,
          expiresAt: MoreThan(new Date()),
        },
      });
      return count > 0;
    } catch (error: unknown) {
      this.logger.error('Any consent existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 동의 이력 조회
   */
  async getConsentHistory(creatorId: string, type?: ConsentType): Promise<CreatorConsentEntity[]> {
    try {
      const where: { creatorId: string; type?: ConsentType } = { creatorId };
      if (type) where.type = type;

      return await this.consentRepo.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Consent history fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.consentFetchError();
    }
  }

  // 복잡한 조회 메서드들 (Repository 사용)

  /**
   * 만료된 동의 조회
   */
  async getExpiredConsents(): Promise<CreatorConsentEntity[]> {
    try {
      return await this.consentRepo.findExpiredConsents();
    } catch (error: unknown) {
      this.logger.error('Expired consents fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 곧 만료될 동의 조회
   */
  async getExpiringConsents(days: number = 7): Promise<CreatorConsentEntity[]> {
    try {
      return await this.consentRepo.findExpiringConsents(days);
    } catch (error: unknown) {
      this.logger.error('Expiring consents fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      throw CreatorException.consentFetchError();
    }
  }

  // 배치 처리 메서드들 (Repository 사용)

  /**
   * 여러 크리에이터의 활성 동의 조회 (배치 처리)
   */
  async getActiveConsentsBatch(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    try {
      return await this.consentRepo.findActiveByCreatorIds(creatorIds);
    } catch (error: unknown) {
      this.logger.error('Active consents batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 여러 크리에이터의 특정 타입 동의 여부 확인 (배치 처리)
   */
  async hasConsentBatch(creatorIds: string[], type: ConsentType): Promise<Record<string, boolean>> {
    try {
      return await this.consentRepo.hasConsentBatch(creatorIds, type);
    } catch (error: unknown) {
      this.logger.error('Consent batch check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
        type,
      });
      throw CreatorException.consentFetchError();
    }
  }

  // 통계 메서드들 (Repository 사용)

  /**
   * 크리에이터별 동의 통계
   */
  async getStatsByCreatorId(creatorId: string): Promise<ConsentStats> {
    try {
      return await this.consentRepo.getStatsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Consent stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }

  /**
   * 동의 타입별 통계
   */
  async getStatsByConsentType(): Promise<Record<ConsentType, number>> {
    try {
      return await this.consentRepo.getStatsByConsentType();
    } catch (error: unknown) {
      this.logger.error('Consent type stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.consentFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async grantConsent(
    dto: {
      creatorId: string;
      type: ConsentType;
      expiresAt?: Date;
      consentData?: string;
      version?: string;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 동의 무효화
      await this.consentRepo.update(
        { creatorId: dto.creatorId, type: dto.type, isGranted: true },
        { isGranted: false, revokedAt: new Date() }
      );

      // 새 동의 생성
      const consent = this.consentRepo.create({
        ...dto,
        isGranted: true,
        grantedAt: new Date(),
      });

      await this.consentRepo.saveEntity(consent, transactionManager);

      this.logger.log('Consent granted successfully', {
        creatorId: dto.creatorId,
        type: dto.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Consent grant failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId: dto.creatorId,
        type: dto.type,
      });

      throw CreatorException.consentCreateError();
    }
  }

  async revokeConsent(
    creatorId: string,
    type: ConsentType,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const updateResult = await this.consentRepo.update(
        { creatorId, type, isGranted: true },
        { isGranted: false, revokedAt: new Date() }
      );

      if (updateResult.affected === 0) {
        this.logger.warn('Consent revoke failed: consent not found', {
          creatorId,
          type,
        });
        throw CreatorException.consentNotFound();
      }

      this.logger.log('Consent revoked successfully', {
        creatorId,
        type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Consent revoke failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });

      throw CreatorException.consentUpdateError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================
}
