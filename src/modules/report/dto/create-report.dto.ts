import { IsEnum, IsString, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ReportTargetType, ReportReason } from '../enums/index.js';

export class ReportEvidenceDto {
  @ApiPropertyOptional({
    description: '스크린샷 URL 목록',
    type: [String],
    example: ['https://example.com/screenshot1.png', 'https://example.com/screenshot2.png'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];

  @ApiPropertyOptional({
    description: '관련 URL 목록',
    type: [String],
    example: ['https://example.com/related-content'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urls?: string[];

  @ApiPropertyOptional({
    description: '추가 증거 정보',
    type: 'object',
    example: { userAgent: 'Mozilla/5.0...', timestamp: '2024-01-01T00:00:00Z' },
  })
  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, unknown>;
}

export class CreateReportDto {
  @ApiProperty({
    description: '신고 대상 타입',
    enum: ReportTargetType,
    example: ReportTargetType.CONTENT,
  })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty({
    description: '신고 대상 ID',
    example: 'content-uuid-here',
  })
  @IsString()
  targetId!: string;

  @ApiProperty({
    description: '신고 사유',
    enum: ReportReason,
    example: ReportReason.INAPPROPRIATE_CONTENT,
  })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiPropertyOptional({
    description: '신고 상세 설명',
    example: '부적절한 콘텐츠가 포함되어 있습니다.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '신고 증거 자료',
    type: ReportEvidenceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportEvidenceDto)
  evidence?: ReportEvidenceDto;
}