import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsInt, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { VideoSyncStatus } from '@common/enums/index.js';

export class UpdatePlatformSyncDto {
  @ApiPropertyOptional({
    description: '영상 동기화 상태',
    example: VideoSyncStatus.COMPLETED,
    enum: VideoSyncStatus,
  })
  @IsOptional()
  @IsEnum(VideoSyncStatus)
  videoSyncStatus?: VideoSyncStatus;

  @ApiPropertyOptional({
    description: '마지막 영상 동기화 시간',
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastVideoSyncAt?: Date;

  @ApiPropertyOptional({
    description: '동기화 시작 시점',
    example: '2023-12-01T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  syncStartedAt?: Date;

  @ApiPropertyOptional({
    description: '동기화 완료 시점',
    example: '2023-12-01T11:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  syncCompletedAt?: Date;

  @ApiPropertyOptional({
    description: '총 영상 수',
    example: 4500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalVideoCount?: number;

  @ApiPropertyOptional({
    description: '동기화된 영상 수',
    example: 4450,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  syncedVideoCount?: number;

  @ApiPropertyOptional({
    description: '동기화 실패한 영상 수',
    example: 50,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  failedVideoCount?: number;

  @ApiPropertyOptional({
    description: '마지막 동기화 에러 메시지',
    example: 'API quota exceeded',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lastSyncError?: string;

  @ApiPropertyOptional({
    description: '동기화 메타데이터 (JSON 형태)',
    example: '{"retryCount": 3, "batchSize": 100}',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  syncMetadata?: string;
}