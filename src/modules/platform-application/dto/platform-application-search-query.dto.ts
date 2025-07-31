import { IsOptional, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';

import { ApplicationStatus, PlatformType } from '../enums/index.js';

export class PlatformApplicationSearchQueryDto {
  @Expose()
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus | undefined;

  @Expose()
  @IsOptional()
  @IsEnum(PlatformType)
  type?: PlatformType | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  creatorId?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  reviewerId?: string | undefined;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number | undefined = 1;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number | undefined = 20;

  @Expose()
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'reviewedAt' | 'status' | undefined = 'createdAt';

  @Expose()
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' | undefined = 'DESC';
}