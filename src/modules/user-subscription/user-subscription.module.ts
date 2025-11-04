import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/creator.module.js';
import { CreatorEntity } from '../creator/entities/creator.entity.js';
import { CreatorRepository } from '../creator/repositories/creator.repository.js';

import { UserSubscriptionEntity } from './entities/user-subscription.entity.js';
import { UserSubscriptionRepository } from './repositories/user-subscription.repository.js';
import { UserSubscriptionService } from './services/user-subscription.service.js';
import {
  UserSubscriptionController,
  CreatorSubscriptionController,
  SubscriptionController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSubscriptionEntity, CreatorEntity]),
    forwardRef(() => CreatorModule),
  ],
  providers: [UserSubscriptionRepository, UserSubscriptionService, CreatorRepository],
  controllers: [UserSubscriptionController, CreatorSubscriptionController, SubscriptionController],
  exports: [UserSubscriptionService],
})
export class UserSubscriptionModule {}
