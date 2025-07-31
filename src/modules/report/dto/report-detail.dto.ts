import { Expose, Type } from 'class-transformer';

import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';

class ReportEvidenceDto {
  @Expose()
  screenshots?: string[];

  @Expose()
  urls?: string[];

  @Expose()
  additionalInfo?: Record<string, unknown>;
}

class ReportActionDto {
  @Expose()
  actionType?: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'none';

  @Expose()
  duration?: number;

  @Expose()
  reason?: string;
}

class ReporterInfoDto {
  @Expose()
  email!: string;

  @Expose()
  name?: string;
}

class TargetInfoDto {
  @Expose()
  title?: string;

  @Expose()
  name?: string;

  @Expose()
  type?: string;
}

export class ReportDetailDto {
  @Expose()
  id!: string;

  @Expose()
  reporterId!: string;

  @Expose()
  targetType!: ReportTargetType;

  @Expose()
  targetId!: string;

  @Expose()
  reason!: ReportReason;

  @Expose()
  description?: string;

  @Expose()
  @Type(() => ReportEvidenceDto)
  evidence?: ReportEvidenceDto;

  @Expose()
  status!: ReportStatus;

  @Expose()
  reviewerId?: string;

  @Expose()
  reviewedAt?: Date;

  @Expose()
  reviewComment?: string;

  @Expose()
  @Type(() => ReportActionDto)
  actions?: ReportActionDto;

  @Expose()
  priority!: number;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  @Type(() => ReporterInfoDto)
  reporterInfo?: ReporterInfoDto;

  @Expose()
  @Type(() => TargetInfoDto)
  targetInfo?: TargetInfoDto;
}