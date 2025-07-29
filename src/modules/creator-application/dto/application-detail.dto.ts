import { Exclude, Expose, Type } from 'class-transformer';
import { ApplicationStatus, ApplicationData, ReviewData } from '../entities';

export class ApplicationDetailDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  status: ApplicationStatus;

  @Expose()
  appliedAt: Date;

  @Expose()
  reviewedAt?: Date;

  @Expose()
  reviewerId?: string;

  @Expose()
  applicationData: ApplicationData;

  @Expose()
  reviewData?: ReviewData;
}