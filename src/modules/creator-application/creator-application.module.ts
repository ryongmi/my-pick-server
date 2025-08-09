import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/index.js';

import {
  CreatorApplicationEntity,
  CreatorApplicationChannelInfoEntity,
  CreatorApplicationSampleVideoEntity,
  CreatorApplicationReviewEntity,
} from './entities/index.js';
import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
} from './repositories/index.js';
import { CreatorApplicationService } from './services/index.js';
import { CreatorApplicationController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorApplicationEntity,
      CreatorApplicationChannelInfoEntity,
      CreatorApplicationSampleVideoEntity,
      CreatorApplicationReviewEntity,
    ]),
    CreatorModule, // CreatorService 사용을 위해 필요
  ],
  controllers: [CreatorApplicationController],
  providers: [
    CreatorApplicationRepository,
    CreatorApplicationChannelInfoRepository,
    CreatorApplicationSampleVideoRepository,
    CreatorApplicationReviewRepository,
    CreatorApplicationService,
  ],
  exports: [
    CreatorApplicationService,
    CreatorApplicationRepository,
    CreatorApplicationChannelInfoRepository,
    CreatorApplicationSampleVideoRepository,
    CreatorApplicationReviewRepository,
  ],
})
export class CreatorApplicationModule {}
