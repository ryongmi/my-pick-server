import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorEntity } from '../entities/creator.entity.js';

@Injectable()
export class CreatorRepository extends BaseRepository<CreatorEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorEntity, dataSource);
  }

  async findByName(name: string): Promise<CreatorEntity | null> {
    return this.findOne({
      where: { name, isActive: true },
    });
  }

  async findActive(): Promise<CreatorEntity[]> {
    return this.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
}
