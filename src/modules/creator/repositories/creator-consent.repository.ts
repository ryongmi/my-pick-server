import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorConsentEntity } from '../entities/index.js';

@Injectable()
export class CreatorConsentRepository extends BaseRepository<CreatorConsentEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorConsentEntity, dataSource);
  }

}