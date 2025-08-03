import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { VideoSyncStatus } from '@common/enums/index.js';

export class PlatformSyncStatsDto {
  @ApiProperty({
    description: '총 플랫폼 수',
    example: 15,
  })
  @Expose()
  totalPlatforms!: number;

  @ApiProperty({
    description: '총 영상 수',
    example: 50000,
  })
  @Expose()
  totalVideos!: number;

  @ApiProperty({
    description: '동기화된 영상 수',
    example: 48500,
  })
  @Expose()
  syncedVideos!: number;

  @ApiProperty({
    description: '실패한 영상 수',
    example: 1500,
  })
  @Expose()
  failedVideos!: number;

  @ApiProperty({
    description: '전체 진행률 (0-100)',
    example: 97,
  })
  @Expose()
  overallProgress!: number;

  @ApiProperty({
    description: '전체 성공률 (0-100)',
    example: 97.0,
  })
  @Expose()
  overallSuccessRate!: number;
}

export class PlatformSyncStatusCountsDto {
  @ApiProperty({
    description: '한번도 동기화하지 않은 플랫폼 수',
    example: 2,
  })
  @Expose()
  neverSynced!: number;

  @ApiProperty({
    description: '동기화 진행중인 플랫폼 수',
    example: 3,
  })
  @Expose()
  inProgress!: number;

  @ApiProperty({
    description: '동기화 완료된 플랫폼 수',
    example: 8,
  })
  @Expose()
  completed!: number;

  @ApiProperty({
    description: '동기화 실패한 플랫폼 수',
    example: 2,
  })
  @Expose()
  failed!: number;
}