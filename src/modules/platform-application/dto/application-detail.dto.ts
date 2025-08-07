import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApplicationStatus } from '../enums/index.js';
import { PlatformDataDto } from './platform-data.dto.js';
import { ReviewDataDto } from './review-data.dto.js';

export class ApplicationDetailDto {
  @ApiProperty({
    description: '신청서 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '신청한 크리에이터 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  creatorId!: string;

  @ApiProperty({
    description: '신청자 사용자 ID (크리에이터 소유자)',
    example: '789a0123-4567-890b-cdef-123456789012',
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
    description: '플랫폼 데이터',
    type: PlatformDataDto,
  })
  @Expose()
  @Type(() => PlatformDataDto)
  platformData!: PlatformDataDto;

  @ApiPropertyOptional({
    description: '검토 완료일시',
    example: '2023-12-05T14:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: '검토자 ID',
    example: '456b7890-1234-5678-9abc-def123456789',
  })
  @Expose()
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '검토 데이터',
    type: ReviewDataDto,
  })
  @Expose()
  @Type(() => ReviewDataDto)
  reviewData?: ReviewDataDto;

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