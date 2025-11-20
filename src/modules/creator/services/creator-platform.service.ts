import { Injectable, Logger } from '@nestjs/common';

import { CreatorException } from '../exceptions/index.js';
import { CreatorPlatformRepository } from '../repositories/creator-platform.repository.js';
import { CreatorPlatformEntity, SyncProgress } from '../entities/creator-platform.entity.js';
import { PlatformType } from '../enums/index.js';
import { CreatePlatformDto } from '../dto/create-platform.dto.js';

// import { CreatorService } from './creator.service.js';

@Injectable()
export class CreatorPlatformService {
  private readonly logger = new Logger(CreatorPlatformService.name);

  constructor(
    private readonly creatorPlatformRepository: CreatorPlatformRepository
    // private readonly creatorService: CreatorService
  ) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * ID로 플랫폼 조회
   */
  async findById(id: string): Promise<CreatorPlatformEntity | null> {
    return this.creatorPlatformRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * ID로 플랫폼 조회 (없으면 예외 발생)
   */
  async findByIdOrFail(id: string): Promise<CreatorPlatformEntity> {
    const platform = await this.findById(id);
    if (!platform) {
      throw CreatorException.platformNotFound();
    }
    return platform;
  }

  /**
   * 크리에이터의 모든 플랫폼 조회
   */
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    return await this.creatorPlatformRepository.find({
      where: { creatorId, isActive: true },
    });
  }

  /**
   * 플랫폼 타입과 ID로 조회
   */
  async findByPlatformTypeAndId(
    platformType: PlatformType,
    platformId: string
  ): Promise<CreatorPlatformEntity | null> {
    return await this.creatorPlatformRepository.findOne({
      where: { platformType, platformId },
    });
  }

  /**
   * 활성화된 YouTube 플랫폼 목록 조회 (스케줄러용)
   */
  async findActiveYouTubePlatforms(): Promise<CreatorPlatformEntity[]> {
    return await this.creatorPlatformRepository.find({
      where: {
        platformType: PlatformType.YOUTUBE,
        isActive: true,
      },
    });
  }

  /**
   * 플랫폼 정보와 크리에이터 정보 함께 조회
   */
  async findWithCreator(platformId: string): Promise<{
    platform: CreatorPlatformEntity;
    creator: { id: string; name: string; profileImageUrl?: string };
  } | null> {
    return this.creatorPlatformRepository.findWithCreator(platformId);
  }

  /**
   * 플랫폼 계정 추가
   */
  async createPlatform(dto: CreatePlatformDto): Promise<CreatorPlatformEntity> {
    // 외래키 검증: 크리에이터가 존재하는지 확인
    // await this.creatorService.findByIdOrFail(dto.creatorId);

    // 중복 플랫폼 체크
    const existing = await this.findByPlatformTypeAndId(dto.platformType, dto.platformId);
    if (existing) {
      throw CreatorException.platformAlreadyExists();
    }

    const platformData: {
      creatorId: string;
      platformType: PlatformType;
      platformId: string;
      isActive: boolean;
      platformUsername?: string;
      platformUrl?: string;
    } = {
      creatorId: dto.creatorId,
      platformType: dto.platformType,
      platformId: dto.platformId,
      isActive: true,
    };
    if (dto.platformUsername !== undefined) {
      platformData.platformUsername = dto.platformUsername;
    }
    if (dto.platformUrl !== undefined) {
      platformData.platformUrl = dto.platformUrl;
    }

    const platform = this.creatorPlatformRepository.create(platformData);

    const saved = await this.creatorPlatformRepository.save(platform);

    this.logger.log('Creator platform added successfully', {
      platformId: saved.id,
      creatorId: dto.creatorId,
      platformType: dto.platformType,
    });

    return saved;
  }

  /**
   * 플랫폼 정보 수정
   */
  async updatePlatform(
    id: string,
    updates: {
      platformUsername?: string;
      platformUrl?: string;
    }
  ): Promise<void> {
    await this.findByIdOrFail(id);
    await this.creatorPlatformRepository.update(id, updates);

    this.logger.log('Creator platform updated', {
      platformId: id,
      updates: Object.keys(updates),
    });
  }

  /**
   * 동기화 진행 상태 업데이트 (YouTube 스케줄러용)
   *
   * undefined 값을 전달하면 해당 필드를 제거합니다.
   * 이를 통해 동기화 완료 시 nextPageToken, fullSyncProgress 등을 정리할 수 있습니다.
   */
  async updateSyncProgress(id: string, syncProgress: Partial<SyncProgress>): Promise<void> {
    const platform = await this.findByIdOrFail(id);

    // 기존 syncProgress가 없으면 빈 객체로 초기화
    const currentProgress = platform.syncProgress || {};

    // 기존 값으로 시작
    const updatedProgress: Record<string, any> = { ...currentProgress };

    // 새 값 처리: undefined는 필드 제거, 그 외는 덮어쓰기
    const clearedFields: string[] = [];
    Object.entries(syncProgress).forEach(([key, value]) => {
      if (value === undefined) {
        // undefined는 필드 제거
        delete updatedProgress[key];
        clearedFields.push(key);
      } else {
        // 그 외 값은 덮어쓰기
        updatedProgress[key] = value;
      }
    });

    // json 필드 병합을 위해 as any 사용
    // Typeorm이 json 필드의 부분 업데이트를 지원하지 않음
    await this.creatorPlatformRepository.update(id, {
      syncProgress: updatedProgress as any,
    });

    this.logger.debug('Sync progress updated', {
      platformId: id,
      videoSyncStatus: updatedProgress.videoSyncStatus,
      clearedFields: clearedFields.length > 0 ? clearedFields : undefined,
    });
  }

  /**
   * 마지막 동기화 시간 업데이트
   */
  async updateLastSyncTime(id: string): Promise<void> {
    const platform = await this.findByIdOrFail(id);

    // 기존 syncProgress가 없으면 빈 객체로 초기화
    const currentProgress = platform.syncProgress || {};

    const updatedProgress: Partial<SyncProgress> = {
      ...currentProgress,
      lastVideoSyncAt: new Date().toISOString(),
    };

    await this.creatorPlatformRepository.update(id, {
      syncProgress: updatedProgress as any,
    });

    this.logger.debug('Last sync time updated', { platformId: id });
  }

  /**
   * 플랫폼 비활성화
   */
  async deactivatePlatform(id: string): Promise<void> {
    await this.findByIdOrFail(id);
    await this.creatorPlatformRepository.update(id, { isActive: false });

    this.logger.log('Creator platform deactivated', { platformId: id });
  }
}
