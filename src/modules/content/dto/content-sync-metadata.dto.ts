import { Expose } from 'class-transformer';

export class ContentSyncMetadataDto {
  @Expose()
  contentId!: string;

  @Expose()
  apiCallCount!: number;

  @Expose()
  quotaUsed!: number;

  @Expose()
  lastQuotaReset?: Date;

  @Expose()
  syncDuration?: number;

  @Expose()
  dataVersion?: string;

  @Expose()
  updatedAt!: Date;
}

export class UpdateSyncMetadataDto {
  @Expose()
  apiCallCount?: number;

  @Expose()
  quotaUsed?: number;

  @Expose()
  lastQuotaReset?: Date;

  @Expose()
  syncDuration?: number;

  @Expose()
  dataVersion?: string;
}
