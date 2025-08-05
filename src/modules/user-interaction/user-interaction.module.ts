import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionEntity } from './entities/index.js';
import { UserInteractionRepository } from './repositories/index.js';
import { UserInteractionService } from './services/index.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserInteractionEntity])],
  providers: [UserInteractionRepository, UserInteractionService],
  exports: [UserInteractionService, UserInteractionRepository],
})
export class UserInteractionModule {}