import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionEntity } from './entities';
import { UserInteractionRepository } from './repositories';
import { UserInteractionService } from './services';

@Module({
  imports: [TypeOrmModule.forFeature([UserInteractionEntity])],
  providers: [UserInteractionRepository, UserInteractionService],
  exports: [UserInteractionService, UserInteractionRepository],
})
export class UserInteractionModule {}