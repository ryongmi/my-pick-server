import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorEntity, CreatorPlatformEntity, CreatorPlatformSyncEntity, CreatorConsentEntity } from './entities/index.js';
import { CreatorRepository, CreatorPlatformRepository, CreatorPlatformSyncRepository, CreatorConsentRepository } from './repositories/index.js';
import { CreatorService, CreatorPlatformService, CreatorPlatformSyncService, CreatorConsentService } from './services/index.js';
import { CreatorController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorEntity,
      CreatorPlatformEntity,
      CreatorPlatformSyncEntity,
      CreatorConsentEntity,
    ]),
  ],
  controllers: [CreatorController],
  providers: [
    // Repositories
    CreatorRepository,
    CreatorPlatformRepository,
    CreatorPlatformSyncRepository,
    CreatorConsentRepository,
    
    // Services
    CreatorService,
    CreatorPlatformService,
    CreatorPlatformSyncService,
    CreatorConsentService,
  ],
  exports: [
    // 다른 모듈에서 사용할 수 있도록 서비스 export
    CreatorService,
    CreatorPlatformService,
    CreatorPlatformSyncService,
    CreatorConsentService,
  ],
})
export class CreatorModule {}