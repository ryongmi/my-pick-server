import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/index.js';

import { UserSubscriptionEntity } from './entities/index.js';
import { UserSubscriptionRepository } from './repositories/index.js';
import { UserSubscriptionService } from './services/index.js';
import {
  UserSubscriptionController,
  CreatorSubscriberController,
  UserSubscriptionTcpController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSubscriptionEntity]),
    CreatorModule, // CreatorService 의존성
  ],
  controllers: [
    UserSubscriptionController,
    CreatorSubscriberController,
    UserSubscriptionTcpController,
  ],
  providers: [UserSubscriptionRepository, UserSubscriptionService],
  exports: [UserSubscriptionService, UserSubscriptionRepository],
})
export class UserSubscriptionModule {}

