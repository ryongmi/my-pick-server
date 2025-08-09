import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { VideoSyncStatus } from '@common/enums/index.js';

export class PlatformSyncDetailDto {
  @ApiProperty({
    description: '동기화 정보 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '플랫폼 ID (CreatorPlatformEntity의 ID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Expose()
  platformId!: string;

  @ApiProperty({
    description: '영상 동기화 상태',
    example: VideoSyncStatus.COMPLETED,
    enum: VideoSyncStatus,
  })
  @Expose()
  videoSyncStatus!: VideoSyncStatus;

  @ApiPropertyOptional({
    description: '마지막 영상 동기화 시간',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  lastVideoSyncAt?: Date;

  @ApiPropertyOptional({
    description: '동기화 시작 시점',
    example: '2023-12-01T09:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  syncStartedAt?: Date;

  @ApiPropertyOptional({
    description: '동기화 완료 시점',
    example: '2023-12-01T11:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  syncCompletedAt?: Date;

  @ApiPropertyOptional({
    description: '총 영상 수',
    example: 4500,
  })
  @Expose()
  totalVideoCount?: number;

  @ApiPropertyOptional({
    description: '동기화된 영상 수',
    example: 4450,
  })
  @Expose()
  syncedVideoCount?: number;

  @ApiPropertyOptional({
    description: '동기화 실패한 영상 수',
    example: 50,
  })
  @Expose()
  failedVideoCount?: number;

  @ApiPropertyOptional({
    description: '마지막 동기화 에러 메시지',
    example: 'API quota exceeded',
  })
  @Expose()
  lastSyncError?: string;

  @ApiPropertyOptional({
    description: '동기화 메타데이터 (JSON 형태)',
    example: '{"retryCount": 3, "batchSize": 100}',
  })
  @Expose()
  syncMetadata?: string;

  @ApiProperty({
    description: '동기화 진행률 (0-100)',
    example: 98,
  })
  @Expose()
  syncProgress!: number;

  @ApiProperty({
    description: '동기화 성공률 (0-100)',
    example: 98.9,
  })
  @Expose()
  syncSuccessRate!: number;

  @ApiProperty({
    description: '생성일시',
    example: '2023-01-01T00:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2023-12-01T00:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
