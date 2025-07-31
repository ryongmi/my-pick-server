import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportEntity } from './entities/index.js';
import { ReportRepository } from './repositories/index.js';
import { ReportService } from './services/index.js';
import {
  ReportController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity]),
  ],
  controllers: [
    ReportController,
  ],
  providers: [
    ReportRepository,
    ReportService,
  ],
  exports: [
    ReportService,
  ],
})
export class ReportModule {}