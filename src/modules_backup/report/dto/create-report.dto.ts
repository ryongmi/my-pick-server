import { IsEnum, IsString, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

import { ReportTargetType, ReportReason } from '../enums/index.js';

class ReportEvidenceDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urls?: string[];

  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, unknown>;
}

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsString()
  targetId!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportEvidenceDto)
  evidence?: ReportEvidenceDto;
}