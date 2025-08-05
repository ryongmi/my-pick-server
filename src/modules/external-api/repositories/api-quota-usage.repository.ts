import { Injectable } from '@nestjs/common';

import { DataSource, Between, LessThan } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { ApiQuotaUsageEntity } from '../entities/index.js';
import { ApiProvider, ApiOperation } from '../enums/index.js';

@Injectable()
export class ApiQuotaUsageRepository extends BaseRepository<ApiQuotaUsageEntity> {
  constructor(private dataSource: DataSource) {
    super(ApiQuotaUsageEntity, dataSource);
  }

  async findByProviderAndDateRange(
    apiProvider: ApiProvider,
    startDate: Date,
    endDate: Date
  ): Promise<ApiQuotaUsageEntity[]> {
    return this.find({
      where: {
        apiProvider,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProviderAndWeekRange(
    apiProvider: ApiProvider,
    startDate: Date,
    endDate: Date
  ): Promise<ApiQuotaUsageEntity[]> {
    return this.find({
      where: {
        apiProvider,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteOldRecords(cutoffDate: Date): Promise<{ deletedCount: number }> {
    const deleteResult = await this.delete({
      createdAt: LessThan(cutoffDate),
    });

    return {
      deletedCount: deleteResult.affected || 0,
    };
  }

  async getTotalRecordCount(): Promise<number> {
    return this.count();
  }
}