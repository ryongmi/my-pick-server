import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsOptional, IsArray, MaxLength, IsEnum, ValidateIf } from 'class-validator';
import { Expose } from 'class-transformer';

import { RejectionReason } from '../enums/index.js';

export class RejectApplicationDto {
  @ApiProperty({
    description: '검토자 ID',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @Expose()
  @IsString()
  reviewerId!: string;

  @ApiProperty({
    description: '표준화된 거부 사유들 (다중 선택 가능)',
    enum: RejectionReason,
    isArray: true,
    example: [RejectionReason.INSUFFICIENT_FOLLOWERS, RejectionReason.INAPPROPRIATE_CONTENT],
  })
  @Expose()
  @IsArray()
  @IsEnum(RejectionReason, { each: true })
  reasons!: RejectionReason[];

  @ApiPropertyOptional({
    description: 'OTHER 선택 시 필수 - 기타 사유일 때의 상세 설명',
    example: '콘텐츠 품질이 기준에 미달합니다.',
    maxLength: 500,
  })
  @Expose()
  @ValidateIf((o) => o.reasons.includes(RejectionReason.OTHER))
  @IsString()
  @MaxLength(500)
  customReason?: string;

  @ApiPropertyOptional({
    description: '관리자 코멘트',
    example: '구독자 수 기준을 충족하시면 다시 신청해 주세요.',
    maxLength: 1000,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({
    description: '개선이 필요한 요구사항들',
    example: ['구독자 수 10만 달성', '월 5개 이상 영상 업로드', '커뮤니티 가이드라인 준수'],
    type: [String],
  })
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];
}
