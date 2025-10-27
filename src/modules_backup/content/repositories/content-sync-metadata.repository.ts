import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { ContentSyncMetadataEntity } from '../entities/index.js';

@Injectable()
export class ContentSyncMetadataRepository extends BaseRepository<ContentSyncMetadataEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentSyncMetadataEntity, dataSource);
  }

  async findByContentId(contentId: string): Promise<ContentSyncMetadataEntity | null> {
    return this.findOneById(contentId);
  }

  async updateSyncMetadata(
    contentId: string,
    metadata: Partial<Omit<ContentSyncMetadataEntity, 'contentId' | 'updatedAt'>>
  ): Promise<void> {
    await this.upsert(
      {
        contentId,
        ...metadata,
      },
      ['contentId']
    );
  }

  async incrementApiCallCount(contentId: string, increment = 1): Promise<void> {
    await this.createQueryBuilder()
      .insert()
      .into(ContentSyncMetadataEntity)
      .values({
        contentId,
        apiCallCount: increment,
        quotaUsed: 0,
      })
      .orUpdate(['apiCallCount'], ['contentId'])
      .setParameter('apiCallCount', () => 'VALUES(apiCallCount) + apiCallCount')
      .execute();
  }
}
