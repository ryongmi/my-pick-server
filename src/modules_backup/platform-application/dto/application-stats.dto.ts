import { Expose } from 'class-transformer';

export class ApplicationStatsDto {
  @Expose()
  pending!: number;

  @Expose()
  approved!: number;

  @Expose()
  rejected!: number;

  @Expose()
  total!: number;

  @Expose()
  approvalRate!: number;

  @Expose()
  rejectionRate!: number;

  @Expose()
  avgProcessingDays!: number;

  @Expose()
  totalByPlatform!: Record<string, number>;
}
