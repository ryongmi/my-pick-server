import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';

import { ApplicationStatus, PlatformType } from '../enums/index.js';

export class PlatformApplicationSearchQueryDto {
  @ApiPropertyOptional({
    description: '신청 상태로 필터링',
    enum: ApplicationStatus,
    example: ApplicationStatus.PENDING,
  })
  @Expose()
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: '플랫폼 타입으로 필터링',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @Expose()
  @IsOptional()
  @IsEnum(PlatformType)
  type?: PlatformType;

  @ApiPropertyOptional({
    description: '크리에이터 ID로 필터링',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({
    description: '검토자 ID로 필터링',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @Expose()
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '페이지 번호',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지 당 항목 수',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '정렬 기준',
    enum: ['createdAt', 'reviewedAt', 'status'],
    example: 'createdAt',
    default: 'createdAt',
  })
  @Expose()
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'reviewedAt' | 'status' = 'createdAt';

  @ApiPropertyOptional({
    description: '정렬 순서',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    default: 'DESC',
  })
  @Expose()
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
