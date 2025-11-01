import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionEntity } from './entities/user-interaction.entity.js';
import { UserInteractionService } from './services/user-interaction.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserInteractionEntity])],
  providers: [UserInteractionService],
  exports: [UserInteractionService],
})
export class UserInteractionModule {}
