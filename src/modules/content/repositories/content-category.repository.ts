import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { ContentCategoryEntity } from '../entities/content-category.entity.js';

@Injectable()
export class ContentCategoryRepository extends Repository<ContentCategoryEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentCategoryEntity, dataSource.createEntityManager());
  }

  /**
   * 콘텐츠의 모든 카테고리 조회
   */
  async findByContentId(contentId: string): Promise<ContentCategoryEntity[]> {
    return this.find({
      where: { contentId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * 콘텐츠의 주 카테고리 조회
   */
  async findPrimaryByContentId(contentId: string): Promise<ContentCategoryEntity | null> {
    return this.findOne({
      where: { contentId, isPrimary: true },
    });
  }

  /**
   * 특정 카테고리의 콘텐츠 ID 목록 조회
   */
  async findContentIdsByCategory(category: string): Promise<string[]> {
    const results = await this.find({
      where: { category },
      select: ['contentId'],
    });

    return results.map((r) => r.contentId);
  }

  /**
   * 배치 저장 (YouTube 동기화용)
   */
  async saveBatch(categories: Partial<ContentCategoryEntity>[]): Promise<ContentCategoryEntity[]> {
    return this.save(categories);
  }

  /**
   * 콘텐츠의 카테고리 삭제
   */
  async deleteByContentId(contentId: string): Promise<void> {
    await this.delete({ contentId });
  }
}
