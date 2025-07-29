import { Injectable } from '@nestjs/common';

import { DataSource, In } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorPlatformEntity } from '../entities/index.js';

@Injectable()
export class CreatorPlatformRepository extends BaseRepository<CreatorPlatformEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformEntity, dataSource);
  }

  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    return this.find({
      where: { creatorId },
    });
  }

  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformEntity[]> {
    if (creatorIds.length === 0) return [];

    return this.find({
      where: { creatorId: In(creatorIds) },
    });
  }

  async deleteByCreatorId(creatorId: string): Promise<void> {
    await this.delete({ creatorId });
  }

  // save 메서드들은 BaseRepository의 save, saveEntity 메서드를 직접 사용 가능
  // async save() 및 async saveMany() 메서드 제거 - 기본 save 메서드 사용
}

