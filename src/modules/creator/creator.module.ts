import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserSubscriptionModule } from '@modules/user-subscription/index.js';
import { ContentModule } from '@modules/content/index.js';

import { CreatorEntity, CreatorPlatformEntity } from './entities/index.js';
import { CreatorRepository, CreatorPlatformRepository } from './repositories/index.js';
import { CreatorService, CreatorPlatformService } from './services/index.js';
import { CreatorController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorEntity, CreatorPlatformEntity]),
    UserSubscriptionModule,
    ContentModule,
  ],
  controllers: [CreatorController],
  providers: [CreatorRepository, CreatorPlatformRepository, CreatorService, CreatorPlatformService],
  exports: [CreatorService, CreatorPlatformService, CreatorRepository, CreatorPlatformRepository],
})
export class CreatorModule {}

