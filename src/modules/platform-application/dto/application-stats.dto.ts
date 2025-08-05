import { Expose } from 'class-transformer';

export class ApplicationStatsDto {
  @Expose()
  pending!: number;

  @Expose()
  approved!: number;

  @Expose()
  rejected!: number;

  @Expose()
  totalByPlatform!: Record<string, number>;
}