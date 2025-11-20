import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';

import { ContentCategoryRepository } from '../repositories/content-category.repository.js';
import { ContentCategoryEntity } from '../entities/content-category.entity.js';
import { ContentCategorySource } from '../enums/index.js';

import { ContentService } from './content.service.js';

export interface AddCategoryDto {
  contentId: string;
  category: string;
  isPrimary?: boolean;
  subcategory?: string;
  confidence?: number;
  source?: ContentCategorySource;
  classifiedBy?: string;
}

@Injectable()
export class ContentCategoryService {
  private readonly logger = new Logger(ContentCategoryService.name);

  constructor(
    private readonly contentCategoryRepository: ContentCategoryRepository,
    // 순환 참조 방지를 위해 Inject + forwardRef 사용
    @Inject(forwardRef(() => ContentService))
    private readonly contentService: ContentService
  ) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * 콘텐츠의 모든 카테고리 조회
   */
  async findByContentId(contentId: string): Promise<ContentCategoryEntity[]> {
    return this.contentCategoryRepository.findByContentId(contentId);
  }

  /**
   * 콘텐츠의 주 카테고리 조회
   */
  async findPrimaryByContentId(contentId: string): Promise<ContentCategoryEntity | null> {
    return this.contentCategoryRepository.findPrimaryByContentId(contentId);
  }

  /**
   * 특정 카테고리의 콘텐츠 ID 목록 조회
   */
  async findContentIdsByCategory(category: string): Promise<string[]> {
    return this.contentCategoryRepository.findContentIdsByCategory(category);
  }

  /**
   * 카테고리 추가
   */
  async addCategory(dto: AddCategoryDto): Promise<ContentCategoryEntity> {
    // 외래키 검증: Content가 존재하는지 확인
    await this.contentService.findByIdOrFail(dto.contentId);

    // 중복 체크
    const existing = await this.contentCategoryRepository.findOne({
      where: {
        contentId: dto.contentId,
        category: dto.category,
      },
    });

    if (existing) {
      this.logger.warn('Category already exists', {
        contentId: dto.contentId,
        category: dto.category,
      });
      return existing;
    }

    // 주 카테고리 설정 시 기존 주 카테고리 해제
    if (dto.isPrimary) {
      const currentPrimary = await this.findPrimaryByContentId(dto.contentId);
      if (currentPrimary) {
        await this.contentCategoryRepository.update(
          {
            contentId: dto.contentId,
            category: currentPrimary.category,
          },
          { isPrimary: false }
        );
      }
    }

    const categoryData: {
      contentId: string;
      category: string;
      isPrimary: boolean;
      confidence: number;
      source: ContentCategorySource;
      subcategory?: string;
      classifiedBy?: string;
    } = {
      contentId: dto.contentId,
      category: dto.category,
      isPrimary: dto.isPrimary ?? false,
      confidence: dto.confidence ?? 1.0,
      source: dto.source ?? ContentCategorySource.PLATFORM,
    };
    if (dto.subcategory !== undefined) {
      categoryData.subcategory = dto.subcategory;
    }
    if (dto.classifiedBy !== undefined) {
      categoryData.classifiedBy = dto.classifiedBy;
    }

    const category = this.contentCategoryRepository.create(categoryData);

    const saved = await this.contentCategoryRepository.save(category);

    this.logger.debug('Category added to content', {
      contentId: dto.contentId,
      category: dto.category,
      isPrimary: dto.isPrimary,
    });

    return saved;
  }

  /**
   * 카테고리 배치 추가 (YouTube 동기화용)
   */
  async addBatch(dtos: AddCategoryDto[]): Promise<ContentCategoryEntity[]> {
    const categories = dtos.map((dto) => {
      const categoryData: {
        contentId: string;
        category: string;
        isPrimary: boolean;
        confidence: number;
        source: ContentCategorySource;
        subcategory?: string;
        classifiedBy?: string;
      } = {
        contentId: dto.contentId,
        category: dto.category,
        isPrimary: dto.isPrimary ?? false,
        confidence: dto.confidence ?? 1.0,
        source: dto.source ?? ContentCategorySource.PLATFORM,
      };
      if (dto.subcategory !== undefined) {
        categoryData.subcategory = dto.subcategory;
      }
      if (dto.classifiedBy !== undefined) {
        categoryData.classifiedBy = dto.classifiedBy;
      }

      return this.contentCategoryRepository.create(categoryData);
    });

    const saved = await this.contentCategoryRepository.saveBatch(categories);

    this.logger.debug('Categories batch added', { count: saved.length });

    return saved;
  }

  /**
   * 카테고리 삭제
   */
  async removeCategory(contentId: string, category: string): Promise<void> {
    await this.contentCategoryRepository.delete({
      contentId,
      category,
    });

    this.logger.debug('Category removed from content', { contentId, category });
  }

  /**
   * 콘텐츠의 모든 카테고리 삭제
   */
  async removeAllByContentId(contentId: string): Promise<void> {
    await this.contentCategoryRepository.deleteByContentId(contentId);

    this.logger.debug('All categories removed from content', { contentId });
  }
}
