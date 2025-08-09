import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { PlatformApplicationDataRepository } from '../repositories/index.js';
import { PlatformApplicationDataEntity } from '../entities/index.js';
import { PlatformType } from '../enums/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';

@Injectable()
export class PlatformApplicationDataService {
  private readonly logger = new Logger(PlatformApplicationDataService.name);

  constructor(private readonly appDataRepo: PlatformApplicationDataRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByApplicationId(applicationId: string): Promise<PlatformApplicationDataEntity | null> {
    try {
      return await this.appDataRepo.findByApplicationId(applicationId);
    } catch (error: unknown) {
      this.logger.error('Platform application data fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
  }

  async findByApplicationIdOrFail(applicationId: string): Promise<PlatformApplicationDataEntity> {
    const data = await this.findByApplicationId(applicationId);
    if (!data) {
      throw PlatformApplicationException.applicationNotFound();
    }
    return data;
  }

  async checkPlatformExists(type: PlatformType, platformId: string): Promise<boolean> {
    try {
      const existing = await this.appDataRepo.findByPlatformTypeAndId(type, platformId);
      return !!existing;
    } catch (error: unknown) {
      this.logger.error('Platform existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        platformId,
      });
      return false;
    }
  }

  // ==================== 변경 메서드 ====================

  async createApplicationData(
    applicationId: string,
    platformData: {
      type: PlatformType;
      platformId: string;
      url: string;
      displayName: string;
      description?: string;
      followerCount?: number;
      verificationProofType: string;
      verificationProofUrl: string;
      verificationProofDescription: string;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const data: any = {
        applicationId,
        type: platformData.type,
        platformId: platformData.platformId,
        url: platformData.url,
        displayName: platformData.displayName,
        verificationProofType: platformData.verificationProofType,
        verificationProofUrl: platformData.verificationProofUrl,
        verificationProofDescription: platformData.verificationProofDescription,
      };

      if (platformData.description !== undefined) {
        data.description = platformData.description;
      }
      if (platformData.followerCount !== undefined) {
        data.followerCount = platformData.followerCount;
      }

      const dataEntity = this.appDataRepo.create(data) as unknown as PlatformApplicationDataEntity;
      await this.appDataRepo.saveEntity(dataEntity, transactionManager);

      this.logger.log('Platform application data created', {
        applicationId,
        type: platformData.type,
        platformId: platformData.platformId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application data creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        type: platformData.type,
      });

      throw PlatformApplicationException.applicationCreateError();
    }
  }

  async updateApplicationData(
    applicationId: string,
    platformData: Partial<{
      type: PlatformType;
      platformId: string;
      url: string;
      displayName: string;
      description: string;
      followerCount: number;
      verificationProofType: string;
      verificationProofUrl: string;
      verificationProofDescription: string;
    }>,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (platformData.type !== undefined) {
        updateData.type = platformData.type;
      }
      if (platformData.platformId !== undefined) {
        updateData.platformId = platformData.platformId;
      }
      if (platformData.url !== undefined) {
        updateData.url = platformData.url;
      }
      if (platformData.displayName !== undefined) {
        updateData.displayName = platformData.displayName;
      }
      if (platformData.description !== undefined) {
        updateData.description = platformData.description;
      }
      if (platformData.followerCount !== undefined) {
        updateData.followerCount = platformData.followerCount;
      }
      if (platformData.verificationProofType !== undefined) {
        updateData.verificationProofType = platformData.verificationProofType;
      }
      if (platformData.verificationProofUrl !== undefined) {
        updateData.verificationProofUrl = platformData.verificationProofUrl;
      }
      if (platformData.verificationProofDescription !== undefined) {
        updateData.verificationProofDescription = platformData.verificationProofDescription;
      }

      const updateResult = await this.appDataRepo.update({ applicationId }, updateData);

      if (updateResult.affected === 0) {
        throw PlatformApplicationException.applicationNotFound();
      }

      this.logger.log('Platform application data updated', {
        applicationId,
        updatedFields: Object.keys(platformData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application data update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });

      throw PlatformApplicationException.applicationUpdateError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================
}
