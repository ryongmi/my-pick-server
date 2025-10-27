import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { PlatformApplicationDataEntity } from '../entities/index.js';
import { PlatformType } from '../enums/index.js';

@Injectable()
export class PlatformApplicationDataRepository extends BaseRepository<PlatformApplicationDataEntity> {
  constructor(private dataSource: DataSource) {
    super(PlatformApplicationDataEntity, dataSource);
  }

  async findByApplicationId(applicationId: string): Promise<PlatformApplicationDataEntity | null> {
    return this.findOne({
      where: { applicationId },
    });
  }

  async findByPlatformTypeAndId(
    type: PlatformType,
    platformId: string
  ): Promise<PlatformApplicationDataEntity | null> {
    return this.findOne({
      where: { type, platformId },
    });
  }
}
