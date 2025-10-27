import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';

@Injectable()
export class CreatorPlatformRepository extends BaseRepository<CreatorPlatformEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformEntity, dataSource);
  }

  // async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
  //   return this.find({
  //     where: { creatorId, isActive: true },
  //   });
  // }

  // async findByPlatformTypeAndId(
  //   platformType: PlatformType,
  //   platformId: string
  // ): Promise<CreatorPlatformEntity | null> {
  //   return this.findOne({
  //     where: { platformType, platformId },
  //   });
  // }

  async findWithCreator(platformId: string): Promise<{
    platform: CreatorPlatformEntity;
    creator: { id: string; name: string; profileImageUrl?: string };
  } | null> {
    const result = await this.createQueryBuilder('platform')
      .select([
        'platform.id',
        'platform.creatorId',
        'platform.platformType',
        'platform.platformId',
        'platform.platformUsername',
        'platform.platformUrl',
        'platform.syncProgress',
        'platform.isActive',
        'creator.id',
        'creator.name',
        'creator.profileImageUrl',
      ])
      .innerJoin('creators', 'creator', 'creator.id = platform.creatorId')
      .where('platform.id = :platformId', { platformId })
      .getRawOne();

    if (!result) return null;

    return {
      platform: {
        id: result.platform_id,
        creatorId: result.platform_creatorId,
        platformType: result.platform_platformType,
        platformId: result.platform_platformId,
        platformUsername: result.platform_platformUsername,
        platformUrl: result.platform_platformUrl,
        syncProgress: result.platform_syncProgress,
        isActive: result.platform_isActive,
      } as CreatorPlatformEntity,
      creator: {
        id: result.creator_id,
        name: result.creator_name,
        profileImageUrl: result.creator_profileImageUrl,
      },
    };
  }
}
