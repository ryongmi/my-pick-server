import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, MoreThan } from 'typeorm';

import { CreatorConsentEntity, ConsentType } from '../entities/creator-consent.entity.js';
import { CreatorConsentRepository } from '../repositories/creator-consent.repository.js';
import { CreatorException } from '../exceptions/creator.exception.js';

export interface GrantConsentDto {
  creatorId: string;
  type: ConsentType;
  expiresAt?: Date;
  consentData?: string;
  version?: string;
}

@Injectable()
export class CreatorConsentService {
  private readonly logger = new Logger(CreatorConsentService.name);

  constructor(private readonly consentRepo: CreatorConsentRepository) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================
  
  async getActiveConsents(creatorId: string): Promise<ConsentType[]> {
    try {
      const consents = await this.consentRepo.findActiveConsents(creatorId);
      return consents.map(consent => consent.type);
    } catch (error: unknown) {
      this.logger.error('Failed to get active consents', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }
  
  async hasConsent(creatorId: string, type: ConsentType): Promise<boolean> {
    try {
      const consent = await this.consentRepo.findActiveConsentByType(creatorId, type);
      return !!consent;
    } catch (error: unknown) {
      this.logger.error('Failed to check consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.consentFetchError();
    }
  }

  async getConsentHistory(creatorId: string, type?: ConsentType): Promise<CreatorConsentEntity[]> {
    try {
      return await this.consentRepo.findConsentHistory(creatorId, type);
    } catch (error: unknown) {
      this.logger.error('Failed to get consent history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.consentFetchError();
    }
  }

  // 배치 조회 메서드
  async getCreatorConsents(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    if (creatorIds.length === 0) return {};

    try {
      const consents = await this.consentRepo.find({
        where: {
          creatorId: creatorIds.length === 1 ? creatorIds[0] : undefined,
          isGranted: true,
          expiresAt: MoreThan(new Date()),
        },
      });

      const result: Record<string, ConsentType[]> = {};
      creatorIds.forEach(id => {
        result[id] = [];
      });

      consents.forEach(consent => {
        if (result[consent.creatorId]) {
          result[consent.creatorId].push(consent.type);
        }
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Failed to get creator consents batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorIds,
      });
      throw CreatorException.consentFetchError();
    }
  }
  
  // ==================== 변경 메서드 ====================
  
  async grantConsent(dto: GrantConsentDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const manager = transactionManager || this.consentRepo.manager;

      // 기존 동의 무효화 (같은 타입의 활성 동의가 있다면)
      await manager.update(
        CreatorConsentEntity,
        { 
          creatorId: dto.creatorId, 
          type: dto.type, 
          isGranted: true 
        },
        { 
          isGranted: false, 
          revokedAt: new Date() 
        }
      );

      // 새 동의 생성
      const consent = this.consentRepo.create({
        creatorId: dto.creatorId,
        type: dto.type,
        isGranted: true,
        grantedAt: new Date(),
        expiresAt: dto.expiresAt,
        consentData: dto.consentData,
        version: dto.version,
      });
      
      await manager.save(consent);

      this.logger.log('Consent granted successfully', {
        creatorId: dto.creatorId,
        type: dto.type,
        expiresAt: dto.expiresAt,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to grant consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId: dto.creatorId,
        type: dto.type,
      });
      throw CreatorException.consentCreateError();
    }
  }
  
  async revokeConsent(creatorId: string, type: ConsentType, transactionManager?: EntityManager): Promise<void> {
    try {
      const manager = transactionManager || this.consentRepo.manager;

      const updateResult = await manager.update(
        CreatorConsentEntity,
        { 
          creatorId, 
          type, 
          isGranted: true 
        },
        { 
          isGranted: false, 
          revokedAt: new Date() 
        }
      );

      if (updateResult.affected === 0) {
        this.logger.warn('No active consent found to revoke', {
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
      if (error instanceof CreatorException) {
        throw error;
      }

      this.logger.error('Failed to revoke consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        type,
      });
      throw CreatorException.consentUpdateError();
    }
  }
  
  // ==================== 최적화 메서드 (필수) ====================
  
  async getExpiredConsents(): Promise<CreatorConsentEntity[]> {
    try {
      return await this.consentRepo.findExpiredConsents();
    } catch (error: unknown) {
      this.logger.error('Failed to get expired consents', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.consentFetchError();
    }
  }

  async hasAnyConsent(creatorId: string): Promise<boolean> {
    try {
      const activeConsents = await this.getActiveConsents(creatorId);
      return activeConsents.length > 0;
    } catch (error: unknown) {
      this.logger.error('Failed to check if creator has any consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }

  async getSoonToExpireConsents(creatorId: string): Promise<CreatorConsentEntity[]> {
    try {
      return await this.consentRepo.findSoonToExpireConsents(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get soon to expire consents', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.consentFetchError();
    }
  }

  async getConsentStatistics(): Promise<Array<{
    type: ConsentType;
    totalCount: number;
    activeCount: number;
    expiredCount: number;
  }>> {
    try {
      return await this.consentRepo.getConsentStatistics();
    } catch (error: unknown) {
      this.logger.error('Failed to get consent statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.consentFetchError();
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * 동의 만료 알림이 필요한 크리에이터 조회
   */
  async getCreatorsNeedingConsentRenewal(): Promise<string[]> {
    try {
      const soonToExpire = await this.consentRepo.find({
        where: {
          isGranted: true,
          expiresAt: MoreThan(new Date()),
        },
      });

      // 7일 이내 만료되는 동의가 있는 크리에이터 ID 추출
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const creatorIds = new Set<string>();
      soonToExpire.forEach(consent => {
        if (consent.expiresAt && consent.expiresAt <= sevenDaysFromNow) {
          creatorIds.add(consent.creatorId);
        }
      });

      return Array.from(creatorIds);
    } catch (error: unknown) {
      this.logger.error('Failed to get creators needing consent renewal', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.consentFetchError();
    }
  }
}