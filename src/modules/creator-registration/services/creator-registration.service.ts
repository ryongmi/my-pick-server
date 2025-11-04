import { Injectable, Logger } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { PlatformType as CommonPlatformType } from '@common/enums/index.js';

import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { YouTubeApiService } from '../../external-api/services/youtube-api.service.js';
import { CreatorRegistrationRepository } from '../repositories/creator-registration.repository.js';
import {
  CreatorRegistrationEntity,
  PlatformType,
  RegistrationStatus,
} from '../entities/creator-registration.entity.js';
import { CreateRegistrationDto, RegistrationDetailDto } from '../dto/index.js';
import { CreatorRegistrationException } from '../exceptions/index.js';

@Injectable()
export class CreatorRegistrationService {
  private readonly logger = new Logger(CreatorRegistrationService.name);

  constructor(
    private readonly registrationRepo: CreatorRegistrationRepository,
    private readonly youtubeApi: YouTubeApiService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly dataSource: DataSource
  ) {}

  // ==================== PUBLIC METHODS (사용자) ====================

  /**
   * 크리에이터 신청 제출
   */
  async submitRegistration(userId: string, dto: CreateRegistrationDto): Promise<string> {
    // 1. 중복 신청 체크 (PENDING 상태만)
    const hasActive = await this.registrationRepo.hasActiveRegistration(userId);
    if (hasActive) {
      throw CreatorRegistrationException.activeRegistrationExists();
    }

    // 2. YouTube API로 채널 정보 검증 (실제 존재하는 채널인지)
    if (dto.platform === PlatformType.YOUTUBE) {
      const channelInfo = await this.youtubeApi.getChannelInfo(dto.channelId);
      if (!channelInfo) {
        throw CreatorRegistrationException.channelNotFound();
      }

      // 3. 이미 등록된 채널인지 확인
      const existingPlatform = await this.creatorPlatformService.findByPlatformTypeAndId(
        CommonPlatformType.YOUTUBE as any,
        dto.channelId
      );
      if (existingPlatform) {
        throw CreatorRegistrationException.channelAlreadyRegistered();
      }

      // 4. 신청 엔티티 생성 (YouTube 데이터 포함)
      const channelData: any = {
        platform: dto.platform,
        channelId: dto.channelId,
        channelUrl: dto.channelUrl,
        channelName: channelInfo.title,
        subscriberCount: channelInfo.statistics.subscriberCount,
        videoCount: channelInfo.statistics.videoCount,
        description: channelInfo.description,
      };

      if (channelInfo.thumbnails.high || channelInfo.thumbnails.medium) {
        channelData.thumbnailUrl = channelInfo.thumbnails.high || channelInfo.thumbnails.medium;
      }
      if (channelInfo.customUrl) {
        channelData.customUrl = channelInfo.customUrl;
      }
      if (channelInfo.brandingSettings.country) {
        channelData.country = channelInfo.brandingSettings.country;
      }
      channelData.publishedAt = channelInfo.publishedAt.toISOString();

      const registrationData: any = {
        userId,
        channelInfo: channelData,
        status: RegistrationStatus.PENDING,
        appliedAt: new Date(),
      };

      if (dto.registrationMessage) {
        registrationData.registrationMessage = dto.registrationMessage;
      }

      const registration = this.registrationRepo.create(registrationData);
      const saved = await this.registrationRepo.save(registration);
      const savedEntity = (Array.isArray(saved) ? saved[0] : saved) as CreatorRegistrationEntity;

      this.logger.log('Creator registration submitted', {
        registrationId: savedEntity.id,
        userId,
        channelId: dto.channelId,
        channelName: channelInfo.title,
      });

      return savedEntity.id;
    }

    throw CreatorRegistrationException.platformNotSupported();
  }

  /**
   * 사용자의 활성 신청 조회 (PENDING만)
   */
  async findActiveRegistration(userId: string): Promise<CreatorRegistrationEntity | null> {
    return this.registrationRepo.findOne({
      where: { userId, status: RegistrationStatus.PENDING },
    });
  }

  /**
   * 신청 상태 조회 (사용자)
   */
  async getMyRegistrationStatus(userId: string): Promise<RegistrationDetailDto | null> {
    const registration = await this.registrationRepo.findLatestByUserId(userId);

    return registration;
  }

  /**
   * 신청 상세 조회 (권한 체크 포함)
   */
  async getRegistrationById(
    registrationId: string,
    requestUserId: string
  ): Promise<RegistrationDetailDto> {
    const registration = await this.findByIdOrFail(registrationId);

    // 본인 신청만 조회 가능
    if (registration.userId !== requestUserId) {
      throw CreatorRegistrationException.notRegistrationOwner();
    }

    return registration;
  }

  // ==================== PUBLIC METHODS (관리자) ====================

  /**
   * 신청 승인 (트랜잭션)
   */
  async approveRegistration(
    registrationId: string,
    reviewerId: string,
    comment?: string
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const registration = await manager.findOne(CreatorRegistrationEntity, {
        where: { id: registrationId },
      });

      if (!registration) {
        throw CreatorRegistrationException.registrationNotFound();
      }

      if (registration.status !== RegistrationStatus.PENDING) {
        throw CreatorRegistrationException.registrationAlreadyReviewed();
      }

      const channelInfo = registration.channelInfo;

      // 1. Creator 생성 (CreatorService의 createFromApplication 사용)
      const creator = await this.creatorService.createFromApplication(
        registration.userId,
        registrationId,
        channelInfo
      );

      // 2. CreatorPlatform 생성
      const platformData: any = {
        creatorId: creator.id,
        platformType: CommonPlatformType.YOUTUBE,
        platformId: channelInfo.channelId,
        isActive: true,
      };

      if (channelInfo.customUrl !== undefined) {
        platformData.platformUsername = channelInfo.customUrl;
      }
      if (channelInfo.channelUrl !== undefined) {
        platformData.platformUrl = channelInfo.channelUrl;
      }

      await this.creatorPlatformService.createPlatform(platformData);

      // 3. 신청 상태 업데이트
      registration.status = RegistrationStatus.APPROVED;

      const reviewInfoData: any = {
        reviewerId,
        reviewedAt: new Date().toISOString(),
      };
      if (comment) {
        reviewInfoData.comment = comment;
      }
      registration.reviewInfo = reviewInfoData;

      await manager.save(registration);

      this.logger.log('Creator registration approved', {
        registrationId,
        creatorId: creator.id,
        reviewerId,
      });

      return creator.id;
    });
  }

  /**
   * 신청 거부
   */
  async rejectRegistration(
    registrationId: string,
    reviewerId: string,
    reason: string,
    comment?: string
  ): Promise<void> {
    const registration = await this.findByIdOrFail(registrationId);

    if (registration.status !== RegistrationStatus.PENDING) {
      throw CreatorRegistrationException.registrationAlreadyReviewed();
    }

    registration.status = RegistrationStatus.REJECTED;

    const reviewInfoData: any = {
      reviewerId,
      reviewedAt: new Date().toISOString(),
      reason,
    };
    if (comment) {
      reviewInfoData.comment = comment;
    }
    registration.reviewInfo = reviewInfoData;

    await this.registrationRepo.save(registration);

    this.logger.log('Creator registration rejected', {
      registrationId,
      reviewerId,
      reason,
    });
  }

  /**
   * 신청 목록 조회 (관리자, 페이지네이션)
   */
  async searchRegistrations(options: {
    status?: RegistrationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ registrations: CreatorRegistrationEntity[]; total: number }> {
    const [registrations, total] = await this.registrationRepo.searchRegistrations(options);

    return { registrations, total };
  }

  /**
   * 신청 통계 조회 (관리자)
   */
  async getRegistrationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const pending = await this.registrationRepo.countByStatus(RegistrationStatus.PENDING);
    const approved = await this.registrationRepo.countByStatus(RegistrationStatus.APPROVED);
    const rejected = await this.registrationRepo.countByStatus(RegistrationStatus.REJECTED);

    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  async findByIdOrFail(id: string): Promise<CreatorRegistrationEntity> {
    const registration = await this.registrationRepo.findOne({ where: { id } });
    if (!registration) {
      throw CreatorRegistrationException.registrationNotFound();
    }
    return registration;
  }
}
