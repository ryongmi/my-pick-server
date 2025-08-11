import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
} from '../repositories/index.js';
import { CreatorApplicationEntity } from '../entities/index.js';
import {
  ApplicationDetailDto,
  NormalizedApplicationDetailDto,
} from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';

@Injectable()
export class CreatorApplicationService {
  private readonly logger = new Logger(CreatorApplicationService.name);

  constructor(
    private readonly applicationRepo: CreatorApplicationRepository,
    private readonly channelInfoRepo: CreatorApplicationChannelInfoRepository,
    private readonly sampleVideoRepo: CreatorApplicationSampleVideoRepository,
    private readonly reviewRepo: CreatorApplicationReviewRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findById(applicationId: string): Promise<CreatorApplicationEntity | null> {
    return this.applicationRepo.findOneById(applicationId);
  }

  async findByIdOrFail(applicationId: string): Promise<CreatorApplicationEntity> {
    const application = await this.findById(applicationId);
    if (!application) {
      this.logger.warn('Application not found', { applicationId });
      throw CreatorApplicationException.applicationNotFound();
    }
    return application;
  }

  async findByIds(applicationIds: string[]): Promise<CreatorApplicationEntity[]> {
    if (applicationIds.length === 0) {
      return [];
    }
    return this.applicationRepo.findApplicationsByIds(applicationIds);
  }

  async findByUserId(userId: string): Promise<CreatorApplicationEntity | null> {
    return this.applicationRepo.findOne({
      where: { userId },
      order: { appliedAt: 'DESC' },
    });
  }

  async findByUserIds(userIds: string[]): Promise<CreatorApplicationEntity[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.applicationRepo.findByUserIds(userIds);
  }

  // 복합 조회 메서드들
  async getApplicationById(
    applicationId: string,
    requestUserId?: string
  ): Promise<ApplicationDetailDto> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 권한 확인 (신청자 본인만 조회 가능, 관리자는 별도 API)
      if (requestUserId && application.userId !== requestUserId) {
        this.logger.warn('Unauthorized application access attempt', {
          applicationId,
          requestUserId,
          applicationUserId: application.userId,
        });
        throw CreatorApplicationException.notApplicationOwner();
      }

      const detailDto = plainToInstance(ApplicationDetailDto, application, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Application detail fetched', {
        applicationId,
        requestUserId,
        status: application.status,
      });

      return detailDto;
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Application detail fetch',
        { applicationId, requestUserId },
        CreatorApplicationException.applicationFetchError
      );
    }
  }

  async getApplicationStatus(userId: string): Promise<ApplicationDetailDto | null> {
    try {
      const application = await this.findByUserId(userId);

      if (!application) {
        return null;
      }

      const detailDto = plainToInstance(ApplicationDetailDto, application, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Application status fetched', {
        userId,
        status: application.status,
        applicationId: application.id,
      });

      return detailDto;
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Application status fetch',
        { userId },
        CreatorApplicationException.applicationFetchError
      );
    }
  }

  // 정규화된 데이터 조회 메서드
  async getNormalizedApplicationById(
    applicationId: string,
    requestUserId?: string
  ): Promise<NormalizedApplicationDetailDto> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 권한 확인 (신청자 본인만 조회 가능, 관리자는 별도 API)
      if (requestUserId && application.userId !== requestUserId) {
        this.logger.warn('Unauthorized application access attempt', {
          applicationId,
          requestUserId,
          applicationUserId: application.userId,
        });
        throw CreatorApplicationException.notApplicationOwner();
      }

      // 정규화된 데이터 조회
      const [channelInfo, sampleVideos, review] = await Promise.all([
        this.channelInfoRepo.findByApplicationId(applicationId),
        this.sampleVideoRepo.findByApplicationId(applicationId),
        this.reviewRepo.findByApplicationId(applicationId),
      ]);

      const detailDto = plainToInstance(
        NormalizedApplicationDetailDto,
        {
          ...application,
          channelInfo,
          sampleVideos,
          review,
        },
        {
          excludeExtraneousValues: true,
        }
      );

      this.logger.debug('Normalized application detail fetched', {
        applicationId,
        requestUserId,
        status: application.status,
        hasChannelInfo: !!channelInfo,
        sampleVideoCount: sampleVideos?.length || 0,
        hasReview: !!review,
      });

      return detailDto;
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Normalized application detail fetch',
        { applicationId, requestUserId },
        CreatorApplicationException.applicationFetchError
      );
    }
  }

  // ==================== 변경 메서드 ====================

  async updateApplication(
    applicationId: string,
    updates: Partial<CreatorApplicationEntity>,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);
      
      Object.assign(application, updates);
      await this.applicationRepo.updateEntity(application, transactionManager);

      this.logger.log('Application updated successfully', {
        applicationId,
        updatedFields: Object.keys(updates),
      });
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Application update',
        { applicationId, updates },
        CreatorApplicationException.applicationUpdateError
      );
    }
  }

  async deleteApplication(applicationId: string): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);
      
      // 정규화된 데이터 먼저 삭제
      await Promise.all([
        this.channelInfoRepo.deleteByApplicationId(applicationId),
        this.sampleVideoRepo.deleteByApplicationId(applicationId),
        this.reviewRepo.deleteByApplicationId(applicationId),
      ]);

      // 메인 신청서 삭제
      await this.applicationRepo.remove(application);

      this.logger.log('Application deleted successfully', {
        applicationId,
        userId: application.userId,
      });
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Application deletion',
        { applicationId },
        CreatorApplicationException.applicationDeleteError
      );
    }
  }

  // ==================== 집계 메서드 ====================

  async countByUserId(userId: string): Promise<number> {
    return this.applicationRepo.count({ where: { userId } });
  }

  async hasActiveApplication(userId: string): Promise<boolean> {
    const count = await this.applicationRepo.countActiveApplications(userId);
    return count > 0;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private handleServiceError(
    error: unknown,
    operation: string,
    context: Record<string, unknown>,
    fallbackException: () => HttpException
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    throw fallbackException();
  }
}