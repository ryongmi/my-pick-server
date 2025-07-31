import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/index.js';

import { PlatformApplicationEntity } from './entities/index.js';
import { PlatformApplicationRepository } from './repositories/index.js';
import { PlatformApplicationService } from './services/index.js';
import {
  PlatformApplicationController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformApplicationEntity]),
    CreatorModule, // CreatorService 사용을 위해 필요
  ],
  controllers: [
    PlatformApplicationController,
  ],
  providers: [PlatformApplicationRepository, PlatformApplicationService],
  exports: [PlatformApplicationService, PlatformApplicationRepository],
})
export class PlatformApplicationModule {}