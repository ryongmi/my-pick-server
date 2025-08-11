import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, DataSource } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import { CreatorException } from '../exceptions/index.js';
import { ConsentType } from '../entities/index.js';
import { CreateCreatorDto, UpdateCreatorDto } from '../dto/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';
import { CreatorConsentService } from './creator-consent.service.js';
import { CreatorService } from './creator.service.js';
import { CreatorAggregateService } from './creator-aggregate.service.js';


@Injectable()
export class CreatorOrchestrationService {
  private readonly logger = new Logger(CreatorOrchestrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly creatorService: CreatorService,
    private readonly creatorAggregateService: CreatorAggregateService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly creatorConsentService: CreatorConsentService
  ) {}

  // ==================== 도메인 오케스트레이션 메서드 ====================

  async createCreatorWithPlatforms(
    dto: CreateCreatorDto,
    platforms: { 
      type: PlatformType; 
      platformId: string; 
      url?: string; 
      displayName?: string; 
    }[],
    consents: ConsentType[],
    transactionManager?: EntityManager
  ): Promise<string> {
    try {
      this.logger.log('Starting creator creation with platforms and consents', {
        name: dto.name,
        platformCount: platforms.length,
        consentCount: consents.length,
      });

      const creatorId = await this.creatorService.createCreator(dto, transactionManager);

      // 플랫폼 추가
      for (const platform of platforms) {
        await this.creatorPlatformService.createPlatform(
          {
            creatorId,
            type: platform.type,
            platformId: platform.platformId,
            url: platform.url || `https://${platform.type}.com/${platform.platformId}`,
            displayName: platform.displayName || platform.platformId,
          },
          transactionManager
        );
      }

      // 동의 설정
      for (const consentType of consents) {
        await this.creatorConsentService.grantConsent(
          { creatorId, type: consentType },
          transactionManager
        );
      }

      // 캐시 무효화
      await this.creatorAggregateService.invalidateCreatorCache(creatorId);

      this.logger.log('Creator created with platforms and consents', {
        creatorId,
        name: dto.name,
        platformCount: platforms.length,
        consentCount: consents.length,
      });

      return creatorId;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator creation with platforms failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: dto.name,
        platformCount: platforms.length,
      });
      throw CreatorException.creatorCreateError();
    }
  }

  async updateCreatorWithPlatformSync(
    creatorId: string,
    dto: UpdateCreatorDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 크리에이터 업데이트
      await this.creatorService.updateCreator(creatorId, dto, transactionManager);

      // 2. 플랫폼 정보 동기화 트리거
      await this.triggerPlatformInfoUpdate(creatorId);

      // 3. 캐시 갱신
      await this.creatorAggregateService.refreshCreatorCache(creatorId);

      this.logger.log('Creator updated with platform sync', {
        creatorId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator update with platform sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        updatedFields: Object.keys(dto),
      });
      throw CreatorException.creatorUpdateError();
    }
  }

  async deleteCreatorComplete(creatorId: string, _transactionManager?: EntityManager): Promise<void> {
    try {
      this.logger.log('Starting complete creator deletion', { creatorId });

      // 1. 플랫폼 제거
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
      for (const platform of platforms) {
        await this.creatorPlatformService.deactivatePlatform(platform.id);
      }

      // 2. 동의 철회
      const consents = await this.creatorConsentService.getActiveConsents(creatorId);
      for (const consentType of consents) {
        await this.creatorConsentService.revokeConsent(creatorId, consentType);
      }

      // 3. 크리에이터 삭제
      await this.creatorService.deleteCreator(creatorId);

      // 4. 캐시 무효화
      await this.creatorAggregateService.invalidateCreatorCache(creatorId);

      this.logger.log('Creator deletion completed', {
        creatorId,
        removedPlatforms: platforms.length,
        revokedConsents: consents.length,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Complete creator deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorDeleteError();
    }
  }

  // ==================== 플랫폼 관리 오케스트레이션 ====================

  async addPlatformWithConsentValidation(
    creatorId: string,
    platformType: PlatformType,
    platformId: string,
    requiredConsents: ConsentType[] = [ConsentType.DATA_COLLECTION]
  ): Promise<void> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(creatorId);

      // 2. 필요한 동의 확인
      for (const consentType of requiredConsents) {
        const hasConsent = await this.creatorConsentService.hasConsent(creatorId, consentType);
        if (!hasConsent) {
          this.logger.warn('Platform addition blocked: missing required consent', {
            creatorId,
            platformType,
            missingConsent: consentType,
          });
          throw CreatorException.insufficientPermissions();
        }
      }

      // 3. 플랫폼 추가
      await this.creatorPlatformService.createPlatform({ creatorId, type: platformType, platformId, url: '', displayName: '' });

      // 4. 캐시 갱신
      await this.creatorAggregateService.refreshCreatorCache(creatorId);

      this.logger.log('Platform added with consent validation', {
        creatorId,
        platformType,
        platformId,
        validatedConsents: requiredConsents,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform addition with consent validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType,
        platformId,
      });
      throw CreatorException.platformCreateError();
    }
  }

  // ==================== 동의 관리 오케스트레이션 ====================

  async updateConsentWithCacheRefresh(
    creatorId: string,
    consentType: ConsentType,
    granted: boolean
  ): Promise<void> {
    try {
      if (granted) {
        await this.creatorConsentService.grantConsent({ creatorId, type: consentType });
      } else {
        await this.creatorConsentService.revokeConsent(creatorId, consentType);
      }

      // 동의 상태 변경 시 캐시 즉시 갱신
      await this.creatorAggregateService.refreshCreatorCache(creatorId);

      this.logger.log('Consent updated with cache refresh', {
        creatorId,
        consentType,
        granted,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Consent update with cache refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        consentType,
        granted,
      });
      throw CreatorException.consentUpdateError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async triggerPlatformInfoUpdate(creatorId: string): Promise<void> {
    try {
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
      
      // 각 플랫폼의 기본 정보만 업데이트 (외부 API 호출 없이)
      for (const platform of platforms) {
        await this.creatorPlatformService.updatePlatform(platform.id, {
          lastSyncAt: new Date(),
        });
      }

      this.logger.debug('Platform info update triggered', {
        creatorId,
        platformCount: platforms.length,
      });
    } catch (error: unknown) {
      this.logger.warn('Platform info update trigger failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
    }
  }
}