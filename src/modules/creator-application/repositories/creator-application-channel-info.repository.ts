import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorApplicationChannelInfoEntity } from '../entities/index.js';

@Injectable()
export class CreatorApplicationChannelInfoRepository extends BaseRepository<CreatorApplicationChannelInfoEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorApplicationChannelInfoEntity, dataSource);
  }

  async findByApplicationId(
    applicationId: string
  ): Promise<CreatorApplicationChannelInfoEntity | null> {
    return this.findOne({ where: { applicationId } });
  }
}
