import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Expose } from 'class-transformer';

export class ApproveApplicationDto {
  @ApiProperty({
    description: '검토자 ID',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @Expose()
  @IsString()
  reviewerId!: string;

  @ApiPropertyOptional({
    description: '승인 사유',
    example: '콘텐츠 품질이 우수하고 구독자 기준을 충족합니다.',
    maxLength: 500,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: '관리자 코멘트',
    example: '좋은 콘텐츠를 제작하고 있습니다. 앞으로도 좋은 활동 부탁드립니다.',
    maxLength: 1000,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
