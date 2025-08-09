import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorApplicationSampleVideoEntity } from '../entities/index.js';

@Injectable()
export class CreatorApplicationSampleVideoRepository extends BaseRepository<CreatorApplicationSampleVideoEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorApplicationSampleVideoEntity, dataSource);
  }

  async findByApplicationId(applicationId: string): Promise<CreatorApplicationSampleVideoEntity[]> {
    return this.find({
      where: { applicationId },
      order: { sortOrder: 'ASC' },
    });
  }

  async deleteByApplicationId(applicationId: string): Promise<void> {
    await this.delete({ applicationId });
  }
}
