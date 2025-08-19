import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/index.js';

import { UserSubscriptionEntity } from './entities/index.js';
import { UserSubscriptionRepository } from './repositories/index.js';
import { UserSubscriptionService, UserSubscriptionOrchestrationService } from './services/index.js';
import { UserSubscriptionController, CreatorSubscriptionController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSubscriptionEntity]),
    CreatorModule, // CreatorService 의존성
  ],
  controllers: [UserSubscriptionController, CreatorSubscriptionController],
  providers: [
    UserSubscriptionRepository, 
    UserSubscriptionService, 
    UserSubscriptionOrchestrationService
  ],
  exports: [
    UserSubscriptionService, 
    UserSubscriptionOrchestrationService, 
    UserSubscriptionRepository
  ],
})
export class UserSubscriptionModule {}
