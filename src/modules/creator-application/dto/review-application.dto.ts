import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApplicationStatus } from '../enums/index.js';

export class ReviewApplicationDto {
  @ApiProperty({
    description: '검토 결과 상태',
    enum: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED],
    example: ApplicationStatus.APPROVED,
  })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED;

  @ApiProperty({
    description: '검토자 ID',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @IsString()
  reviewerId!: string;

  @ApiPropertyOptional({
    description: '검토 사유 (거부 시 필수)',
    example: '구독자 수 기준 미달',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: '검토 코멘트',
    example: '좋은 콘텐츠를 제작하고 있으나, 최소 구독자 수 기준을 충족해주세요.',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: '추가 요구사항 목록 (거부 시 개선사항)',
    example: ['구독자 수 100만 달성', '월 10개 이상 영상 업로드'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];
}