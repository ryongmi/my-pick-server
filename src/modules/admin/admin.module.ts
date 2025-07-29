import { Module } from '@nestjs/common';

import { 
  AdminDashboardController,
  AdminContentController,
  AdminUserController,
  AdminCreatorController,
} from './controllers';
import { AdminDashboardService } from './services';

import { CreatorModule } from '../creator/creator.module';
import { ContentModule } from '../content/content.module';
import { UserSubscriptionModule } from '../user-subscription/user-subscription.module';
import { UserInteractionModule } from '../user-interaction/user-interaction.module';
import { CreatorApplicationModule } from '../creator-application/creator-application.module';

@Module({
  imports: [    
    // 의존하는 도메인 모듈들
    CreatorModule,
    ContentModule,
    UserSubscriptionModule,
    UserInteractionModule,
    CreatorApplicationModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminContentController,
    AdminUserController,
    AdminCreatorController,
  ],
  providers: [
    AdminDashboardService,
  ],
  exports: [
    AdminDashboardService,
  ],
})
export class AdminModule {}