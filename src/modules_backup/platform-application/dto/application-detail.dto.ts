import { Expose, Type } from 'class-transformer';

import { ApplicationStatus } from '../enums/index.js';
import { PlatformData, ReviewData } from '../interfaces/index.js';

export class ApplicationDetailDto {
  @Expose()
  id!: string;

  @Expose()
  creatorId!: string;

  @Expose()
  userId!: string;

  @Expose()
  status!: ApplicationStatus;

  @Expose()
  platformData!: PlatformData;

  @Expose()
  reviewedAt?: Date | undefined;

  @Expose()
  reviewerId?: string | undefined;

  @Expose()
  reviewData?: ReviewData | undefined;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}