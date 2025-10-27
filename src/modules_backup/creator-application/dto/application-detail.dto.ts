import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { ApplicationStatus } from '../enums/index.js';

export class ApplicationDetailDto {
  @ApiProperty({
    description: '신청서 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '신청자 사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  userId!: string;

  @ApiProperty({
    description: '신청 상태',
    enum: ApplicationStatus,
    example: ApplicationStatus.PENDING,
  })
  @Expose()
  status!: ApplicationStatus;

  @ApiProperty({
    description: '신청일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  appliedAt!: Date;

  @ApiPropertyOptional({
    description: '검토 완료일시',
    example: '2023-12-05T14:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: '검토자 ID',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @Expose()
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '신청자 메시지',
    example: '열심히 활동하겠습니다!',
  })
  @Expose()
  applicantMessage?: string;

  @ApiPropertyOptional({
    description: '예상 처리 시간 (일)',
    example: 7,
  })
  @Expose()
  estimatedProcessingDays?: number;

  @ApiProperty({
    description: '우선순위 (높을수록 우선)',
    example: 1,
    default: 0,
  })
  @Expose()
  priority!: number;

  @ApiProperty({
    description: '생성일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
