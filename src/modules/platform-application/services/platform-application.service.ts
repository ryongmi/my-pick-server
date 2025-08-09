import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { SyncStatus, PlatformType } from '@common/enums/index.js';

import {
  PlatformApplicationRepository,
  PlatformApplicationDataRepository,
  PlatformApplicationReviewRepository,
} from '../repositories/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { PlatformApplicationEntity } from '../entities/index.js';
import { ApplicationStatus, VerificationProofType } from '../enums/index.js';
import {
  CreatePlatformApplicationDto,
  UpdatePlatformApplicationDto,
  ApplicationDetailDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  PlatformApplicationSearchQueryDto,
  ApplicationStatsDto,
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
    private readonly creatorPlatformService: CreatorPlatformService
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findById(applicationId: string): Promise<PlatformApplicationEntity | null> {
    try {
      return await this.platformApplyRepo.findOne({
        where: { id: applicationId },
      });
    } catch (error: unknown) {
      this.logger.error('Platform application fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
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
    try {
      return await this.platformApplyRepo.findByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Platform applications fetch by user failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
  }

  async findByCreatorId(creatorId: string): Promise<PlatformApplicationEntity[]> {
    try {
      return await this.platformApplyRepo.findByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Platform applications fetch by creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
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
      platformData: platformData
        ? (() => {
            const platformObj: any = {
              type: platformData.type,
              platformId: platformData.platformId,
              url: platformData.url,
              displayName: platformData.displayName,
              verificationProof: {
                type: platformData.verificationProofType,
                url: platformData.verificationProofUrl,
                description: platformData.verificationProofDescription,
              },
            };
            if (platformData.description !== undefined) {
              platformObj.description = platformData.description;
            }
            if (platformData.followerCount !== undefined) {
              platformObj.followerCount = platformData.followerCount;
            }
            return platformObj;
          })()
        : undefined,
      reviewData: reviewData
        ? (() => {
            const reviewObj: any = {};
            if (reviewData.reasons !== undefined) {
              reviewObj.reasons = reviewData.reasons;
            }
            if (reviewData.customReason !== undefined) {
              reviewObj.customReason = reviewData.customReason;
            }
            if (reviewData.comment !== undefined) {
              reviewObj.comment = reviewData.comment;
            }
            if (reviewData.requirements !== undefined) {
              reviewObj.requirements = reviewData.requirements;
            }
            if (reviewData.reason !== undefined) {
              reviewObj.reason = reviewData.reason;
            }
            return reviewObj;
          })()
        : undefined,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };

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

      const results = await Promise.all(items.map((app) => this.mapToApplicationDetail(app)));

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

  async getApplicationStats(): Promise<ApplicationStatsDto> {
    try {
      return await this.platformApplyRepo.getApplicationStats();
    } catch (error: unknown) {
      this.logger.error('Platform application stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
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
        const platformDataForCreation: any = {
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

  async approveApplication(
    applicationId: string,
    dto: ApproveApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 1. 상태 확인
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Platform application already reviewed', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.applicationAlreadyReviewed();
      }

      // 2. 자기 신청 검토 방지
      if (application.userId === reviewerId) {
        this.logger.warn('Cannot review own platform application', {
          applicationId,
          userId: application.userId,
          reviewerId,
        });
        throw PlatformApplicationException.cannotReviewOwnApplication();
      }

      const manager = transactionManager || this.platformApplyRepo.manager;

      await manager.transaction(async (txManager) => {
        // 3. 신청 승인 처리
        application.status = ApplicationStatus.APPROVED;
        application.reviewerId = reviewerId;
        application.reviewedAt = new Date();

        await txManager.save(application);

        // 4. 리뷰 데이터 저장
        const reviewData: any = {};
        if (dto.comment !== undefined) {
          reviewData.comment = dto.comment;
        }

        await this.platformAppReviewService.createReviewData(applicationId, reviewData, txManager);

        // 5. 실제 플랫폼 생성
        await this.createPlatformFromApplication(application, txManager);

        // 6. 플랫폼 데이터 조회해서 로깅
        const platformData = await this.platformAppDataService.findByApplicationId(applicationId);

        this.logger.log('Platform application approved successfully', {
          applicationId,
          creatorId: application.creatorId,
          platformType: platformData?.type,
          reviewerId,
        });
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
    }
  }

  async rejectApplication(
    applicationId: string,
    dto: RejectApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 1. 상태 확인
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Platform application already reviewed', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.applicationAlreadyReviewed();
      }

      // 2. 자기 신청 검토 방지
      if (application.userId === reviewerId) {
        this.logger.warn('Cannot review own platform application', {
          applicationId,
          userId: application.userId,
          reviewerId,
        });
        throw PlatformApplicationException.cannotReviewOwnApplication();
      }

      // 3. 신청 거부 처리
      application.status = ApplicationStatus.REJECTED;
      application.reviewerId = reviewerId;
      application.reviewedAt = new Date();

      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.transaction(async (txManager) => {
        // 메인 신청 엔티티 업데이트
        await txManager.save(application);

        // 리뷰 데이터 저장
        const rejectReviewData: any = {
          reasons: dto.reasons,
        };

        if (dto.customReason !== undefined) {
          rejectReviewData.customReason = dto.customReason;
        }
        if (dto.comment !== undefined) {
          rejectReviewData.comment = dto.comment;
        }
        if (dto.requirements !== undefined) {
          rejectReviewData.requirements = dto.requirements;
        }

        await this.platformAppReviewService.createReviewData(
          applicationId,
          rejectReviewData,
          txManager
        );
      });

      this.logger.log('Platform application rejected successfully', {
        applicationId,
        reasons: dto.reasons,
        customReason: dto.customReason,
        reviewerId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application rejection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
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
      platformData: platformData
        ? (() => {
            const platformObj: any = {
              type: platformData.type,
              platformId: platformData.platformId,
              url: platformData.url,
              displayName: platformData.displayName,
              verificationProof: {
                type: platformData.verificationProofType,
                url: platformData.verificationProofUrl,
                description: platformData.verificationProofDescription,
              },
            };
            if (platformData.description !== undefined) {
              platformObj.description = platformData.description;
            }
            if (platformData.followerCount !== undefined) {
              platformObj.followerCount = platformData.followerCount;
            }
            return platformObj;
          })()
        : undefined,
      reviewData: reviewData
        ? (() => {
            const reviewObj: any = {};
            if (reviewData.reasons !== undefined) {
              reviewObj.reasons = reviewData.reasons;
            }
            if (reviewData.customReason !== undefined) {
              reviewObj.customReason = reviewData.customReason;
            }
            if (reviewData.comment !== undefined) {
              reviewObj.comment = reviewData.comment;
            }
            if (reviewData.requirements !== undefined) {
              reviewObj.requirements = reviewData.requirements;
            }
            if (reviewData.reason !== undefined) {
              reviewObj.reason = reviewData.reason;
            }
            return reviewObj;
          })()
        : undefined,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (application.reviewedAt !== undefined && application.reviewedAt !== null) {
      result.reviewedAt = application.reviewedAt;
    }
    if (application.reviewerId !== undefined && application.reviewerId !== null) {
      result.reviewerId = application.reviewerId;
    }

    return result;
  }

  private async createPlatformFromApplication(
    application: PlatformApplicationEntity,
    transactionManager: EntityManager
  ): Promise<void> {
    try {
      // 분리된 엔티티에서 플랫폼 데이터 조회
      const platformData = await this.platformAppDataService.findByApplicationId(application.id);

      // 플랫폼 데이터 검증
      if (!platformData || !platformData.type || !platformData.platformId || !platformData.url) {
        throw PlatformApplicationException.invalidPlatformData();
      }

      // CreatorPlatformService를 통해 플랫폼 생성
      const createPlatformData: any = {
        creatorId: application.creatorId,
        type: platformData.type as PlatformType,
        platformId: platformData.platformId,
        url: platformData.url,
      };

      if (platformData.displayName !== undefined) {
        createPlatformData.displayName = platformData.displayName;
      }

      await this.creatorPlatformService.createPlatform(createPlatformData, transactionManager);

      this.logger.log('Platform created from approved application', {
        applicationId: application.id,
        creatorId: application.creatorId,
        platformType: platformData.type,
        platformId: platformData.platformId,
      });
    } catch (error: unknown) {
      this.logger.error('Platform creation from application failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId: application.id,
      });
      throw PlatformApplicationException.platformCreationError();
    }
  }
}
