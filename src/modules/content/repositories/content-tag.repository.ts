import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { ContentTagEntity } from '../entities/content-tag.entity.js';

@Injectable()
export class ContentTagRepository extends Repository<ContentTagEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentTagEntity, dataSource.createEntityManager());
  }

  /**
   * 콘텐츠의 모든 태그 조회
   */
  async findByContentId(contentId: string): Promise<ContentTagEntity[]> {
    return this.find({
      where: { contentId },
      order: { relevanceScore: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * 특정 태그를 가진 콘텐츠 ID 목록 조회
   */
  async findContentIdsByTag(tag: string): Promise<string[]> {
    const results = await this.find({
      where: { tag },
      select: ['contentId'],
      order: { relevanceScore: 'DESC' },
    });

    return results.map((r) => r.contentId);
  }

  /**
   * 인기 태그 조회 (사용 횟수 기준)
   */
  async findPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const results = await this.createQueryBuilder('tag')
      .select('tag.tag', 'tag')
      .addSelect('COUNT(tag.contentId)', 'count')
      .groupBy('tag.tag')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      tag: r.tag,
      count: parseInt(r.count, 10),
    }));
  }

  /**
   * 배치 저장 (YouTube 동기화용)
   */
  async saveBatch(tags: Partial<ContentTagEntity>[]): Promise<ContentTagEntity[]> {
    return this.save(tags);
  }

  /**
   * 콘텐츠의 태그 삭제
   */
  async deleteByContentId(contentId: string): Promise<void> {
    await this.delete({ contentId });
  }

  /**
   * 태그 사용 횟수 증가
   */
  async incrementUsageCount(tag: string, contentId: string): Promise<void> {
    await this.createQueryBuilder()
      .update(ContentTagEntity)
      .set({ usageCount: () => 'usageCount + 1' })
      .where('tag = :tag AND contentId = :contentId', { tag, contentId })
      .execute();
  }
}
