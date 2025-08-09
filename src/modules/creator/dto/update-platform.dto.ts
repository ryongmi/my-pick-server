import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

import { SyncStatus } from '@common/enums/index.js';

export class UpdatePlatformDto {
  @ApiPropertyOptional({
    description: '플랫폼에서의 표시명',
    example: 'PewDiePie',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: '팔로워 수',
    example: 111000000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  followerCount?: number;

  @ApiPropertyOptional({
    description: '콘텐츠 수',
    example: 4500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contentCount?: number;

  @ApiPropertyOptional({
    description: '총 조회수',
    example: 28000000000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalViews?: number;

  @ApiPropertyOptional({
    description: '활성 상태',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '동기화 상태',
    example: SyncStatus.ACTIVE,
    enum: SyncStatus,
  })
  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @ApiPropertyOptional({
    description: '마지막 동기화 시간',
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastSyncAt?: Date;
}
