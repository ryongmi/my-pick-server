import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';

@Injectable()
export class CreatorConsentService {
  private readonly logger = new Logger(CreatorConsentService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
  ) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * 크리에이터 데이터 수집 동의 상태 변경
   */
  async updateDataConsent(
    creatorId: string,
    hasConsent: boolean,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const creator = await this.findCreatorByIdOrFail(creatorId);
      const now = new Date();

      // 동의 상태가 변경되었는지 확인
      const consentChanged = creator.hasDataConsent !== hasConsent;

      if (!consentChanged) {
        this.logger.debug('Data consent status unchanged', {
          creatorId,
          currentConsent: creator.hasDataConsent,
          requestedConsent: hasConsent,
        });
        return;
      }

      // 크리에이터 동의 상태 업데이트
      const updateData: Partial<CreatorEntity> = {
        hasDataConsent: hasConsent,
        lastConsentCheckAt: now,
      };

      if (hasConsent) {
        // 동의 승인 시
        updateData.consentGrantedAt = now;
        updateData.consentExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1년 후
      } else {
        // 동의 철회 시 - null을 사용하여 데이터베이스에서 null로 설정
        (updateData as any).consentGrantedAt = null;
        (updateData as any).consentExpiresAt = null;
      }

      await this.creatorRepo.update(creatorId, updateData);

      // 플랫폼별 동기화 상태 업데이트
      await this.updatePlatformSyncStatusOnConsentChange(creatorId, hasConsent, transactionManager);

      this.logger.log('Creator data consent updated successfully', {
        creatorId,
        hasConsent,
        consentGrantedAt: updateData.consentGrantedAt,
        consentExpiresAt: updateData.consentExpiresAt,
        wasChanged: consentChanged,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator data consent update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        hasConsent,
      });
      throw CreatorException.creatorUpdateError();
    }
  }

  /**
   * 동의 상태 확인 및 만료 처리
   */
  async checkConsentExpiry(creatorId: string): Promise<{
    isValid: boolean;
    isExpiringSoon: boolean;
    daysUntilExpiry?: number;
  }> {
    try {
      const creator = await this.findCreatorByIdOrFail(creatorId);

      if (!creator.hasDataConsent || !creator.consentExpiresAt) {
        return { isValid: false, isExpiringSoon: false };
      }

      const now = new Date();
      const expiryDate = creator.consentExpiresAt;
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isExpired = now > expiryDate;
      const isExpiringSoon = daysUntilExpiry <= 30; // 30일 이내 만료 예정

      if (isExpired) {
        // 동의 만료 시 자동으로 철회 처리
        await this.updateDataConsent(creatorId, false);

        this.logger.warn('Creator consent expired and revoked', {
          creatorId,
          expiryDate: expiryDate.toISOString(),
          daysOverdue: Math.abs(daysUntilExpiry),
        });

        return { isValid: false, isExpiringSoon: false };
      }

      // 마지막 확인 시점 업데이트
      await this.creatorRepo.update(creatorId, {
        lastConsentCheckAt: now,
      });

      this.logger.debug('Creator consent status checked', {
        creatorId,
        isValid: true,
        isExpiringSoon,
        daysUntilExpiry,
      });

      return {
        isValid: true,
        isExpiringSoon,
        daysUntilExpiry,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Consent expiry check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  /**
   * 만료 예정인 크리에이터들 조회
   */
  async findCreatorsWithExpiringConsent(daysThreshold = 30): Promise<CreatorEntity[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const creators = await this.creatorRepo
        .createQueryBuilder('creator')
        .where('creator.hasDataConsent = :hasConsent', { hasConsent: true })
        .andWhere('creator.consentExpiresAt <= :thresholdDate', { thresholdDate })
        .orderBy('creator.consentExpiresAt', 'ASC')
        .getMany();

      this.logger.debug('Found creators with expiring consent', {
        count: creators.length,
        daysThreshold,
        thresholdDate: thresholdDate.toISOString(),
      });

      return creators;
    } catch (error: unknown) {
      this.logger.error('Failed to find creators with expiring consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysThreshold,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  /**
   * 동의 상태 일괄 갱신 (스케줄러에서 사용)
   */
  async batchUpdateConsentStatus(): Promise<{
    expiredCount: number;
    expiringSoonCount: number;
    totalChecked: number;
  }> {
    try {
      // 동의한 크리에이터 모두 조회
      const consentedCreators = await this.creatorRepo.find({
        where: { hasDataConsent: true },
      });

      let expiredCount = 0;
      let expiringSoonCount = 0;
      const totalChecked = consentedCreators.length;

      for (const creator of consentedCreators) {
        try {
          const status = await this.checkConsentExpiry(creator.id);

          if (!status.isValid) {
            expiredCount++;
          } else if (status.isExpiringSoon) {
            expiringSoonCount++;
          }
        } catch (error: unknown) {
          this.logger.warn('Individual consent check failed during batch update', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId: creator.id,
          });
        }
      }

      this.logger.log('Batch consent status update completed', {
        totalChecked,
        expiredCount,
        expiringSoonCount,
      });

      return { expiredCount, expiringSoonCount, totalChecked };
    } catch (error: unknown) {
      this.logger.error('Batch consent status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async findCreatorByIdOrFail(creatorId: string): Promise<CreatorEntity> {
    const creator = await this.creatorRepo.findOneById(creatorId);
    if (!creator) {
      this.logger.warn('Creator not found', { creatorId });
      throw CreatorException.creatorNotFound();
    }
    return creator;
  }

  /**
   * 동의 상태 변경 시 플랫폼 동기화 상태 업데이트
   */
  private async updatePlatformSyncStatusOnConsentChange(
    creatorId: string,
    hasConsent: boolean,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 동의 상태에 따른 동기화 상태 결정
      const updateData = hasConsent
        ? {
            // 동의 승인 시: 전체 재동기화 필요
            videoSyncStatus: VideoSyncStatus.CONSENT_CHANGED,
          }
        : {
            // 동의 철회 시: 증분 동기화로 전환 (데이터 수집 중단)
            videoSyncStatus: VideoSyncStatus.INCREMENTAL,
          };

      // CreatorPlatformService를 통한 일괄 업데이트
      await this.creatorPlatformService.updatePlatformSyncStatusByCreatorId(
        creatorId,
        updateData,
        transactionManager
      );

      this.logger.debug('Platform sync status updated for consent change', {
        creatorId,
        hasConsent,
        newSyncStatus: updateData.videoSyncStatus,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform sync status on consent change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        hasConsent,
      });
      // 주요 동의 업데이트를 막지 않기 위해 예외를 던지지 않음
    }
  }
}