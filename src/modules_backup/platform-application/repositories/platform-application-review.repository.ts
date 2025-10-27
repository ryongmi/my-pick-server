import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { PlatformApplicationReviewEntity } from '../entities/index.js';

@Injectable()
export class PlatformApplicationReviewRepository extends BaseRepository<PlatformApplicationReviewEntity> {
  constructor(private dataSource: DataSource) {
    super(PlatformApplicationReviewEntity, dataSource);
  }

  async findByApplicationId(
    applicationId: string
  ): Promise<PlatformApplicationReviewEntity | null> {
    return this.findOne({
      where: { applicationId },
    });
  }
}
