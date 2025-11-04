import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/creator.module.js';
import { ExternalApiModule } from '../external-api/external-api.module.js';

import { CreatorRegistrationEntity } from './entities/creator-registration.entity.js';
import { CreatorRegistrationRepository } from './repositories/creator-registration.repository.js';
import { CreatorRegistrationService } from './services/creator-registration.service.js';
import { CreatorRegistrationController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorRegistrationEntity]),
    CreatorModule, // Creator, CreatorPlatform 서비스 사용
    ExternalApiModule, // YouTube API 사용
  ],
  controllers: [CreatorRegistrationController],
  providers: [CreatorRegistrationRepository, CreatorRegistrationService],
  exports: [CreatorRegistrationService],
})
export class CreatorRegistrationModule {}
