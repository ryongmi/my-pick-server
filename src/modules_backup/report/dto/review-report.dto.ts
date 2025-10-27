import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsString, IsOptional, IsNumber, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { ReportStatus, ReportActionType } from '../enums/index.js';

export class ReportActionDto {
  @ApiPropertyOptional({
    description: '신고 조치 타입',
    enum: ReportActionType,
    example: ReportActionType.WARNING,
  })
  @IsOptional()
  @IsEnum(ReportActionType)
  actionType?: ReportActionType;

  @ApiPropertyOptional({
    description: '정지 기간 (일 단위)',
    minimum: 1,
    example: 7,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({
    description: '조치 사유',
    example: '커뮤니티 가이드라인 위반으로 인한 경고 조치',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewReportDto {
  @ApiProperty({
    description: '신고 처리 상태',
    enum: [
      ReportStatus.RESOLVED,
      ReportStatus.REJECTED,
      ReportStatus.DISMISSED,
      ReportStatus.UNDER_REVIEW,
    ],
    example: ReportStatus.RESOLVED,
  })
  @IsEnum([
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
    ReportStatus.DISMISSED,
    ReportStatus.UNDER_REVIEW,
  ])
  status!: ReportStatus;

  @ApiPropertyOptional({
    description: '검토 의견',
    example: '부적절한 콘텐츠로 확인되어 경고 조치합니다.',
  })
  @IsOptional()
  @IsString()
  reviewComment?: string;

  @ApiPropertyOptional({
    description: '신고 조치 정보',
    type: ReportActionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportActionDto)
  actions?: ReportActionDto;
}
