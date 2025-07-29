import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/index.js';

import { CreatorApplicationEntity } from './entities/index.js';
import { CreatorApplicationRepository } from './repositories/index.js';
import { CreatorApplicationService } from './services/index.js';
import {
  CreatorApplicationController,
  AdminCreatorApplicationController,
  CreatorApplicationTcpController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorApplicationEntity]),
    CreatorModule, // CreatorService 사용을 위해 필요
  ],
  controllers: [
    CreatorApplicationController,
    AdminCreatorApplicationController,
    CreatorApplicationTcpController,
  ],
  providers: [CreatorApplicationRepository, CreatorApplicationService],
  exports: [CreatorApplicationService, CreatorApplicationRepository],
})
export class CreatorApplicationModule {}
