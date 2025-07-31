import { Module } from '@nestjs/common';


import { CreatorModule } from '../creator/creator.module.js';
import { ContentModule } from '../content/content.module.js';
import { UserSubscriptionModule } from '../user-subscription/user-subscription.module.js';
import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';
import { CreatorApplicationModule } from '../creator-application/creator-application.module.js';
import { PlatformApplicationModule } from '../platform-application/platform-application.module.js';

import { AdminDashboardService } from './services/index.js';
import { 
  AdminDashboardController,
  AdminContentController,
  AdminUserController,
  AdminCreatorController,
  AdminCreatorApplicationController,
  AdminPlatformApplicationController,
} from './controllers/index.js';

@Module({
  imports: [    
    // 의존하는 도메인 모듈들
    CreatorModule,
    ContentModule,
    UserSubscriptionModule,
    UserInteractionModule,
    CreatorApplicationModule,
    PlatformApplicationModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminContentController,
    AdminUserController,
    AdminCreatorController,
    AdminCreatorApplicationController,
    AdminPlatformApplicationController,
  ],
  providers: [
    AdminDashboardService,
  ],
  exports: [
    AdminDashboardService,
  ],
})
export class AdminModule {}