import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { ReportStatus, ReportTargetType } from '../enums/index.js';

export class ReportSearchQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  reporterId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'priority'])
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}