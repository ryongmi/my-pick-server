import { Module } from '@nestjs/common';

import { AccountMergeService } from './account-merge.service.js';
import { AccountMergeTcpController } from './account-merge-tcp.controller.js';
import { UserSubscriptionModule } from '../user-subscription/user-subscription.module.js';
import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';

@Module({
  imports: [UserSubscriptionModule, UserInteractionModule],
  controllers: [AccountMergeTcpController],
  providers: [AccountMergeService],
  exports: [AccountMergeService],
})
export class AccountMergeModule {}
