import { Injectable, Logger, HttpException } from '@nestjs/common';
import { EntityManager, MoreThan, LessThan } from 'typeorm';

import { CreatorConsentRepository } from '../repositories/index.js';
import { CreatorConsentEntity, ConsentType } from '../entities/index.js';
import { GrantConsentDto } from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorConsentService {
  private readonly logger = new Logger(CreatorConsentService.name);

  constructor(private readonly consentRepo: CreatorConsentRepository) {}

  // ==================== PUBLIC METHODS ====================

  async getActiveConsents(creatorId: string): Promise<string[]> {
    // 현재 유효한 동의 타입 목록 반환
    const consents = await this.consentRepo.find({
      where: {
        creatorId,
        isGranted: true,
        expiresAt: MoreThan(new Date()), // 만료되지 않은 것만
      },
      select: ['type'],
    });
    return consents.map(c => c.type);
  }

  async hasConsent(creatorId: string, type: string): Promise<boolean> {
    const consent = await this.consentRepo.findOne({
      where: {
        creatorId,
        type,
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
    });
    return !!consent;
  }

  async getConsentHistory(creatorId: string, type?: string): Promise<CreatorConsentEntity[]> {
    const where: any = { creatorId };
    if (type) where.type = type;

    return this.consentRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== 변경 메서드 ====================

  async grantConsent(dto: {
    creatorId: string;
    type: string;
    expiresAt?: Date;
    consentData?: string;
    version?: string;
  }, transactionManager?: EntityManager): Promise<void> {
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

      await this.consentRepo.save(consent);

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

  async revokeConsent(creatorId: string, type: string, transactionManager?: EntityManager): Promise<void> {
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

  // ==================== 최적화 메서드 (필수) ====================

  async hasAnyConsent(creatorId: string): Promise<boolean> {
    const count = await this.consentRepo.count({
      where: {
        creatorId,
        isGranted: true,
        expiresAt: MoreThan(new Date()),
      },
    });
    return count > 0;
  }

  async getExpiredConsents(): Promise<CreatorConsentEntity[]> {
    return this.consentRepo.find({
      where: {
        isGranted: true,
        expiresAt: LessThan(new Date()),
      },
      order: { expiresAt: 'ASC' },
    });
  }

  // ==================== PRIVATE HELPER METHODS ====================
}