import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AccountMergeTcpPatterns, TcpMergeUserData } from '@krgeobuk/account-merge/tcp';

import { AccountMergeService } from './account-merge.service.js';

@Controller()
export class AccountMergeTcpController {
  private readonly logger = new Logger(AccountMergeTcpController.name);

  constructor(private readonly accountMergeService: AccountMergeService) {}

  /**
   * MyPick 사용자 데이터 병합 (TCP)
   */
  @MessagePattern(AccountMergeTcpPatterns.MERGE_USER_DATA)
  async mergeUserData(@Payload() data: TcpMergeUserData): Promise<void> {
    try {
      this.logger.log('TCP: Merging MyPick user data', {
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });

      await this.accountMergeService.mergeUserData(data.sourceUserId, data.targetUserId);

      this.logger.log('TCP: MyPick user data merged successfully', {
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });
    } catch (error: unknown) {
      this.logger.error('TCP: Failed to merge MyPick user data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });

      throw error;
    }
  }

  /**
   * MyPick 사용자 데이터 병합 롤백 (TCP 보상 트랜잭션)
   */
  @MessagePattern(AccountMergeTcpPatterns.ROLLBACK_MERGE)
  async rollbackMerge(@Payload() data: TcpMergeUserData): Promise<void> {
    try {
      this.logger.log('TCP: Rolling back MyPick user data merge', {
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });

      await this.accountMergeService.rollbackMerge(data.sourceUserId, data.targetUserId);

      this.logger.log('TCP: MyPick user data rollback successful', {
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });
    } catch (error: unknown) {
      this.logger.error('TCP: Failed to rollback MyPick user data merge', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId: data.sourceUserId,
        targetUserId: data.targetUserId,
      });

      throw error;
    }
  }
}
