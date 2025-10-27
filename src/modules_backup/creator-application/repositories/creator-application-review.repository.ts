import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorApplicationReviewEntity } from '../entities/index.js';

@Injectable()
export class CreatorApplicationReviewRepository extends BaseRepository<CreatorApplicationReviewEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorApplicationReviewEntity, dataSource);
  }

  async findByApplicationId(applicationId: string): Promise<CreatorApplicationReviewEntity | null> {
    return this.findOne({ where: { applicationId } });
  }

  async deleteByApplicationId(applicationId: string): Promise<void> {
    await this.delete({ applicationId });
  }
}
