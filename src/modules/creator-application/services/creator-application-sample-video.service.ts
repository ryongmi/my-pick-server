import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CreatorApplicationSampleVideoRepository } from '../repositories/index.js';
import { CreatorApplicationSampleVideoEntity } from '../entities/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';

export interface CreateSampleVideoDto {
  title: string;
  url: string;
  views: number;
}

@Injectable()
export class CreatorApplicationSampleVideoService {
  private readonly logger = new Logger(CreatorApplicationSampleVideoService.name);

  constructor(
    private readonly sampleVideoRepo: CreatorApplicationSampleVideoRepository,
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByApplicationId(applicationId: string): Promise<CreatorApplicationSampleVideoEntity[]> {
    try {
      return await this.sampleVideoRepo.findByApplicationId(applicationId);
    } catch (error: unknown) {
      this.logger.error('Sample videos fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      // 조회 실패 시 빈 배열 반환 (orchestration에서 처리)
      return [];
    }
  }

  async findById(videoId: string): Promise<CreatorApplicationSampleVideoEntity | null> {
    try {
      return await this.sampleVideoRepo.findOneById(videoId);
    } catch (error: unknown) {
      this.logger.error('Sample video fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
      });
      return null;
    }
  }

  async findByIdOrFail(videoId: string): Promise<CreatorApplicationSampleVideoEntity> {
    const video = await this.findById(videoId);
    if (!video) {
      this.logger.warn('Sample video not found', { videoId });
      throw CreatorApplicationException.sampleVideoNotFound();
    }
    return video;
  }

  // ==================== 변경 메서드 ====================

  async createSampleVideos(
    applicationId: string,
    videos: CreateSampleVideoDto[],
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      if (!videos || videos.length === 0) {
        this.logger.debug('No sample videos to create', { applicationId });
        return;
      }

      // 기존 영상들 제거 (재생성하는 경우를 대비)
      await this.deleteByApplicationId(applicationId, transactionManager);

      // 새로운 영상들 생성
      const sampleVideos = videos.map((video, index) => {
        const entity = this.sampleVideoRepo.create({
          applicationId,
          title: video.title,
          url: video.url,
          views: video.views,
          sortOrder: index + 1, // 1부터 시작하는 정렬 순서
        });
        return entity;
      });

      // 배치 저장
      for (const sampleVideo of sampleVideos) {
        await this.sampleVideoRepo.saveEntity(sampleVideo, transactionManager);
      }

      this.logger.log('Sample videos created successfully', {
        applicationId,
        videoCount: videos.length,
        titles: videos.map(v => v.title),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Sample videos creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        videoCount: videos?.length || 0,
      });
      throw CreatorApplicationException.sampleVideoCreateError();
    }
  }

  async deleteByApplicationId(
    applicationId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      let deletedCount = 0;
      
      if (transactionManager) {
        const result = await transactionManager.delete('creator_application_sample_videos', { applicationId });
        deletedCount = result.affected || 0;
      } else {
        const result = await this.sampleVideoRepo.delete({ applicationId });
        deletedCount = result.affected || 0;
      }

      this.logger.log('Sample videos deleted successfully', {
        applicationId,
        deletedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Sample videos deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw CreatorApplicationException.sampleVideoDeleteError();
    }
  }

  async deleteById(videoId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const video = await this.findByIdOrFail(videoId);
      
      if (transactionManager) {
        await transactionManager.delete('creator_application_sample_videos', { id: videoId });
      } else {
        await this.sampleVideoRepo.delete({ id: videoId });
      }

      this.logger.log('Sample video deleted successfully', {
        videoId,
        applicationId: video.applicationId,
        title: video.title,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Sample video deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
      });
      throw CreatorApplicationException.sampleVideoDeleteError();
    }
  }

  // ==================== 집계 메서드 ====================

  async countByApplicationId(applicationId: string): Promise<number> {
    try {
      return await this.sampleVideoRepo.count({
        where: { applicationId }
      });
    } catch (error: unknown) {
      this.logger.error('Sample video count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      return 0;
    }
  }

  async getTotalViewsByApplicationId(applicationId: string): Promise<number> {
    try {
      const videos = await this.findByApplicationId(applicationId);
      return videos.reduce((total, video) => total + video.views, 0);
    } catch (error: unknown) {
      this.logger.error('Sample video total views calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      return 0;
    }
  }
}