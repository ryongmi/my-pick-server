import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/index.js';

import {
  PlatformApplicationEntity,
  PlatformApplicationDataEntity,
  PlatformApplicationReviewEntity,
} from './entities/index.js';
import {
  PlatformApplicationRepository,
  PlatformApplicationDataRepository,
  PlatformApplicationReviewRepository,
} from './repositories/index.js';
import {
  PlatformApplicationService,
  PlatformApplicationDataService,
  PlatformApplicationReviewService,
} from './services/index.js';
import { PlatformApplicationController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformApplicationEntity,
      PlatformApplicationDataEntity,
      PlatformApplicationReviewEntity,
    ]),
    CreatorModule, // CreatorService 사용을 위해 필요
  ],
  controllers: [PlatformApplicationController],
  providers: [
    PlatformApplicationRepository,
    PlatformApplicationDataRepository,
    PlatformApplicationReviewRepository,
    PlatformApplicationService,
    PlatformApplicationDataService,
    PlatformApplicationReviewService,
  ],
  exports: [
    PlatformApplicationService,
    PlatformApplicationDataService,
    PlatformApplicationReviewService,
    PlatformApplicationRepository,
    PlatformApplicationDataRepository,
    PlatformApplicationReviewRepository,
  ],
})
export class PlatformApplicationModule {}
