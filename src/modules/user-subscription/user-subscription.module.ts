import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserSubscriptionEntity } from './entities/user-subscription.entity.js';
import { CreatorEntity } from '../creator/entities/creator.entity.js';
import { UserSubscriptionRepository } from './repositories/user-subscription.repository.js';
import { CreatorRepository } from '../creator/repositories/creator.repository.js';
import { UserSubscriptionService } from './services/user-subscription.service.js';
import { UserSubscriptionController, CreatorSubscriptionController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSubscriptionEntity, CreatorEntity]),
  ],
  providers: [UserSubscriptionRepository, UserSubscriptionService, CreatorRepository],
  controllers: [UserSubscriptionController, CreatorSubscriptionController],
  exports: [UserSubscriptionService],
})
export class UserSubscriptionModule {}
