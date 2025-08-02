import { IsEnum, IsString, IsOptional, IsNumber, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { ReportStatus } from '../enums/index.js';

class ReportActionDto {
  @IsOptional()
  @IsEnum(['warning', 'suspension', 'ban', 'content_removal', 'none'])
  actionType?: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'none';

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number; // 정지 기간 (일)

  @IsOptional()
  @IsString()
  reason?: string; // 조치 사유
}

export class ReviewReportDto {
  @IsEnum([ReportStatus.RESOLVED, ReportStatus.REJECTED, ReportStatus.DISMISSED, ReportStatus.UNDER_REVIEW])
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  reviewComment?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportActionDto)
  actions?: ReportActionDto;
}