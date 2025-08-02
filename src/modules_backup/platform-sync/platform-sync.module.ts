import { Module } from '@nestjs/common';

import { CreatorModule } from '../creator/creator.module.js';

import { PlatformSyncService } from './services/index.js';

@Module({
  imports: [
    CreatorModule, // CreatorPlatformRepository 사용을 위해 필요
  ],
  providers: [
    PlatformSyncService,
  ],
  exports: [
    PlatformSyncService,
  ],
})
export class PlatformSyncModule {}