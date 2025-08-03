import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorPlatformEntity } from '../entities/index.js';

@Injectable()
export class CreatorPlatformRepository extends BaseRepository<CreatorPlatformEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformEntity, dataSource);
  }

}