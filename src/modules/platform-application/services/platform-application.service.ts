import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { CacheService } from '@database/redis/cache.service.js';

import {
  PlatformApplicationRepository,
} from '../repositories/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { PlatformApplicationEntity } from '../entities/index.js';
import { ApplicationStatus, PlatformType as LocalPlatformType, VerificationProofType } from '../enums/index.js';
import {
  CreatePlatformApplicationDto,
  UpdatePlatformApplicationDto,
  ApplicationDetailDto,
  PlatformApplicationSearchQueryDto,
  PlatformDataDto,
  ReviewDataDto,
} from '../dto/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';

import { PlatformApplicationDataService, PlatformApplicationReviewService } from './index.js';

@Injectable()
export class PlatformApplicationService {
  private readonly logger = new Logger(PlatformApplicationService.name);

  constructor(
    private readonly platformApplyRepo: PlatformApplicationRepository,
    private readonly platformAppDataService: PlatformApplicationDataService,
    private readonly platformAppReviewService: PlatformApplicationReviewService,
    private readonly creatorService: CreatorService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findById(applicationId: string): Promise<PlatformApplicationEntity | null> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.platformApplyRepo.findOne({
          where: { id: applicationId },
        });
      },
      'Find platform application by ID',
      { applicationId },
      null
    );
  }

  async findByIdOrFail(applicationId: string): Promise<PlatformApplicationEntity> {
    const application = await this.findById(applicationId);
    if (!application) {
      this.logger.warn('Platform application not found', { applicationId });
      throw PlatformApplicationException.applicationNotFound();
    }
    return application;
  }

  async findByUserId(userId: string): Promise<PlatformApplicationEntity[]> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.platformApplyRepo.findByUserId(userId);
      },
      'Find platform applications by user ID',
      { userId },
      []
    );
  }

  async findByCreatorId(creatorId: string): Promise<PlatformApplicationEntity[]> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.platformApplyRepo.findByCreatorId(creatorId);
      },
      'Find platform applications by creator ID',
      { creatorId },
      []
    );
  }

  // 복합 조회 메서드들
  async getApplicationDetail(applicationId: string): Promise<ApplicationDetailDto> {
    const application = await this.findByIdOrFail(applicationId);

    // 분리된 엔티티에서 데이터 조회
    const platformData = await this.platformAppDataService.findByApplicationId(applicationId);
    const reviewData = await this.platformAppReviewService.findByApplicationId(applicationId);

    const result: ApplicationDetailDto = {
      id: application.id,
      creatorId: application.creatorId,
      userId: application.userId,
      status: application.status,
      platformType: application.platformType,
      appliedAt: application.appliedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (platformData) {
      result.platformData = {
        type: platformData.type,
        platformId: platformData.platformId,
        url: platformData.url,
        displayName: platformData.displayName,
        description: platformData.description,
        followerCount: platformData.followerCount,
        verificationProof: {
          type: platformData.verificationProofType,
          url: platformData.verificationProofUrl,
          description: platformData.verificationProofDescription,
        },
        createdAt: platformData.createdAt,
        updatedAt: platformData.updatedAt,
      } as PlatformDataDto;
    }

    if (reviewData) {
      result.reviewData = {
        reasons: reviewData.reasons,
        customReason: reviewData.customReason,
        comment: reviewData.comment,
        requirements: reviewData.requirements,
        reason: reviewData.reason,
        createdAt: reviewData.createdAt,
        updatedAt: reviewData.updatedAt,
      } as ReviewDataDto;
    }

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (application.reviewedAt !== undefined && application.reviewedAt !== null) {
      result.reviewedAt = application.reviewedAt;
    }
    if (application.reviewerId !== undefined && application.reviewerId !== null) {
      result.reviewerId = application.reviewerId;
    }

    return result;
  }

  async searchApplications(
    query: PlatformApplicationSearchQueryDto
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    try {
      const { items, total } = await this.platformApplyRepo.searchApplications(query);

      // 배치 처리로 상세 정보 구성 - 최적화된 성능
      const results = await this.buildApplicationDetailsBatch(items);

      const limitValue = query.limit || 20;
      const limitType = this.convertToLimitType(limitValue);

      const currentPage = query.page || 1;
      const totalPages = Math.ceil(total / limitValue);

      return {
        items: results,
        pageInfo: {
          page: currentPage,
          limit: limitType,
          totalItems: total,
          totalPages,
          hasPreviousPage: currentPage > 1,
          hasNextPage: currentPage < totalPages,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Platform applications search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
  }


  // ==================== 변경 메서드 ====================

  async createApplication(
    dto: CreatePlatformApplicationDto,
    userId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(dto.creatorId);

      // 2. 중복 신청 확인
      const existingApplication = await this.platformApplyRepo.findExistingApplication(
        dto.creatorId,
        dto.platformData.type,
        dto.platformData.platformId
      );

      if (existingApplication) {
        this.logger.warn('Platform application already exists', {
          creatorId: dto.creatorId,
          platformType: dto.platformData.type,
          platformId: dto.platformData.platformId,
        });
        throw PlatformApplicationException.applicationAlreadyExists();
      }

      // 3. 이미 등록된 플랫폼인지 확인
      // TODO: Implement platform duplication check after CreatorPlatformService method is available
      // const existingPlatform = await this.creatorPlatformService.findByCreatorIdAndType(
      //   dto.creatorId,
      //   dto.platformData.type as PlatformType
      // );

      // if (existingPlatform && existingPlatform.platformId === dto.platformData.platformId) {
      //   this.logger.warn('Platform already registered', {
      //     creatorId: dto.creatorId,
      //     platformType: dto.platformData.type,
      //     platformId: dto.platformData.platformId,
      //   });
      //   throw PlatformApplicationException.duplicatePlatform();
      // }

      // 4. 신청 엔티티 생성
      const application = new PlatformApplicationEntity();
      application.userId = userId;
      application.creatorId = dto.creatorId;
      application.status = ApplicationStatus.PENDING;

      // 5. 트랜잭션으로 저장
      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.transaction(async (txManager) => {
        // 메인 신청 엔티티 저장
        const savedApplication = await txManager.save(application);

        // 플랫폼 데이터 저장
        const platformDataForCreation: {
          type: LocalPlatformType;
          platformId: string;
          url: string;
          displayName: string;
          description?: string;
          followerCount?: number;
          verificationProofType: VerificationProofType;
          verificationProofUrl: string;
          verificationProofDescription: string;
        } = {
          type: dto.platformData.type,
          platformId: dto.platformData.platformId,
          url: dto.platformData.url,
          displayName: dto.platformData.displayName,
          verificationProofType: dto.platformData.verificationProof.type,
          verificationProofUrl: dto.platformData.verificationProof.url,
          verificationProofDescription: dto.platformData.verificationProof.description,
        };
        
        if (dto.platformData.description !== undefined) {
          platformDataForCreation.description = dto.platformData.description;
        }
        if (dto.platformData.followerCount !== undefined) {
          platformDataForCreation.followerCount = dto.platformData.followerCount;
        }

        await this.platformAppDataService.createApplicationData(
          savedApplication.id,
          platformDataForCreation,
          txManager
        );
      });

      // 플랫폼 신청 관련 캐시 무효화
      await this.cacheService.invalidatePlatformApplicationRelatedCaches();

      this.logger.log('Platform application created successfully', {
        applicationId: application.id,
        creatorId: dto.creatorId,
        platformType: dto.platformData.type,
        userId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dto,
        userId,
      });
      throw PlatformApplicationException.applicationCreateError();
    }
  }

  async updateApplication(
    applicationId: string,
    dto: UpdatePlatformApplicationDto,
    userId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 1. 권한 확인 (신청자만 수정 가능)
      if (application.userId !== userId) {
        this.logger.warn('Unauthorized platform application update attempt', {
          applicationId,
          requestUserId: userId,
          ownerUserId: application.userId,
        });
        throw PlatformApplicationException.notApplicationOwner();
      }

      // 2. 상태 확인 (대기 중인 신청만 수정 가능)
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Cannot modify reviewed platform application', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.cannotModifyReviewedApplication();
      }

      // 3. 트랜잭션 매니저 설정
      const manager = transactionManager || this.platformApplyRepo.manager;

      // 4. 플랫폼 데이터 업데이트
      if (dto.platformData) {
        // 기존 플랫폼 데이터 조회
        const currentPlatformData =
          await this.platformAppDataService.findByApplicationId(applicationId);

        if (currentPlatformData) {
          // 플랫폼 타입/ID가 변경되는 경우 중복 확인
          if (
            dto.platformData.type !== currentPlatformData.type ||
            dto.platformData.platformId !== currentPlatformData.platformId
          ) {
            const existingApplication = await this.platformApplyRepo.findExistingApplication(
              application.creatorId,
              dto.platformData.type,
              dto.platformData.platformId
            );

            if (existingApplication && existingApplication.id !== applicationId) {
              throw PlatformApplicationException.applicationAlreadyExists();
            }
          }

          // 플랫폼 데이터 업데이트
          await this.platformAppDataService.updateApplicationData(
            applicationId,
            dto.platformData,
            manager
          );
        }
      }

      // 5. 저장
      await manager.save(application);

      this.logger.log('Platform application updated successfully', {
        applicationId,
        userId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        dto,
        userId,
      });
      throw PlatformApplicationException.applicationUpdateError();
    }
  }

  async cancelApplication(
    applicationId: string,
    userId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 1. 권한 확인
      if (application.userId !== userId) {
        this.logger.warn('Unauthorized platform application cancel attempt', {
          applicationId,
          requestUserId: userId,
          ownerUserId: application.userId,
        });
        throw PlatformApplicationException.notApplicationOwner();
      }

      // 2. 상태 확인
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Cannot cancel reviewed platform application', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.cannotCancelReviewedApplication();
      }

      // 3. 삭제
      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.remove(application);

      this.logger.log('Platform application cancelled successfully', {
        applicationId,
        userId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application cancel failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        userId,
      });
      throw PlatformApplicationException.applicationDeleteError();
    }
  }



  // ==================== 에러 처리 헬퍼 메서드 ====================

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      throw PlatformApplicationException.applicationFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 숫자 limit을 LimitType enum으로 변환
   */
  private convertToLimitType(limit: number): LimitType {
    if (limit <= 15) return LimitType.FIFTEEN;
    if (limit <= 30) return LimitType.THIRTY;
    if (limit <= 50) return LimitType.FIFTY;
    return LimitType.HUNDRED;
  }

  private async mapToApplicationDetail(
    application: PlatformApplicationEntity
  ): Promise<ApplicationDetailDto> {
    // 분리된 엔티티에서 데이터 조회
    const platformData = await this.platformAppDataService.findByApplicationId(application.id);
    const reviewData = await this.platformAppReviewService.findByApplicationId(application.id);

    const result: ApplicationDetailDto = {
      id: application.id,
      creatorId: application.creatorId,
      userId: application.userId,
      status: application.status,
      platformType: application.platformType,
      appliedAt: application.appliedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (platformData) {
      result.platformData = {
        type: platformData.type,
        platformId: platformData.platformId,
        url: platformData.url,
        displayName: platformData.displayName,
        description: platformData.description,
        followerCount: platformData.followerCount,
        verificationProof: {
          type: platformData.verificationProofType,
          url: platformData.verificationProofUrl,
          description: platformData.verificationProofDescription,
        },
        createdAt: platformData.createdAt,
        updatedAt: platformData.updatedAt,
      } as PlatformDataDto;
    }

    if (reviewData) {
      result.reviewData = {
        reasons: reviewData.reasons,
        customReason: reviewData.customReason,
        comment: reviewData.comment,
        requirements: reviewData.requirements,
        reason: reviewData.reason,
        createdAt: reviewData.createdAt,
        updatedAt: reviewData.updatedAt,
      } as ReviewDataDto;
    }

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (application.reviewedAt !== undefined && application.reviewedAt !== null) {
      result.reviewedAt = application.reviewedAt;
    }
    if (application.reviewerId !== undefined && application.reviewerId !== null) {
      result.reviewerId = application.reviewerId;
    }

    return result;
  }

  // ==================== 배치 처리 메서드 ====================

  private async buildApplicationDetailsBatch(applications: PlatformApplicationEntity[]): Promise<ApplicationDetailDto[]> {
    if (applications.length === 0) return [];

    return await this.executeWithErrorHandling(
      async () => {
        // 1. 각 신청에 대한 platform data 및 review data 배치 조회
        const platformDataPromises = applications.map(app => 
          this.platformAppDataService.findByApplicationId(app.id)
        );
        const reviewDataPromises = applications.map(app => 
          this.platformAppReviewService.findByApplicationId(app.id)
        );

        const [platformDataResults, reviewDataResults] = await Promise.all([
          Promise.all(platformDataPromises),
          Promise.all(reviewDataPromises),
        ]);

        // 2. 결과 조합
        const results = applications.map((application, index) => {
          const platformData = platformDataResults[index];
          const reviewData = reviewDataResults[index];

          const result: ApplicationDetailDto = {
            id: application.id,
            creatorId: application.creatorId,
            userId: application.userId,
            status: application.status,
            platformType: application.platformType,
            appliedAt: application.appliedAt,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
          };

          // 선택적 속성 처리 (exactOptionalPropertyTypes 준수)
          if (platformData) {
            result.platformData = {
              type: platformData.type,
              platformId: platformData.platformId,
              url: platformData.url,
              displayName: platformData.displayName,
              description: platformData.description,
              followerCount: platformData.followerCount,
              verificationProof: {
                type: platformData.verificationProofType,
                url: platformData.verificationProofUrl,
                description: platformData.verificationProofDescription,
              },
              createdAt: platformData.createdAt,
              updatedAt: platformData.updatedAt,
            } as PlatformDataDto;
          }

          if (reviewData) {
            result.reviewData = {
              reasons: reviewData.reasons,
              customReason: reviewData.customReason,
              comment: reviewData.comment,
              requirements: reviewData.requirements,
              reason: reviewData.reason,
              createdAt: reviewData.createdAt,
              updatedAt: reviewData.updatedAt,
            } as ReviewDataDto;
          }

          // 조건부 할당 (exactOptionalPropertyTypes 준수)
          if (application.reviewedAt !== undefined && application.reviewedAt !== null) {
            result.reviewedAt = application.reviewedAt;
          }
          if (application.reviewerId !== undefined && application.reviewerId !== null) {
            result.reviewerId = application.reviewerId;
          }

          return result;
        });

        this.logger.debug('Batch application details built', {
          applicationCount: applications.length,
        });

        return results;
      },
      'Build application details batch',
      { applicationCount: applications.length },
      // fallback: 배치 처리가 실패하면 기본 정보만 폴백
      applications.map(application => ({
        id: application.id,
        creatorId: application.creatorId,
        userId: application.userId,
        status: application.status,
        platformType: application.platformType,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      } as ApplicationDetailDto))
    );
  }

}
