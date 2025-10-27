import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/creator.module.js';

import { UserSubscriptionEntity } from './entities/user-subscription.entity.js';
import { UserSubscriptionRepository } from './repositories/user-subscription.repository.js';
import { UserSubscriptionService } from './services/user-subscription.service.js';
import {
  UserSubscriptionController,
  CreatorSubscriptionController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSubscriptionEntity]),
    // Creator 모듈 import (외래키 검증용)
    forwardRef(() => CreatorModule),
  ],
  providers: [UserSubscriptionRepository, UserSubscriptionService],
  controllers: [UserSubscriptionController, CreatorSubscriptionController],
  exports: [UserSubscriptionService],
})
export class UserSubscriptionModule {}
