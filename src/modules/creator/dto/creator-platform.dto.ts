import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { PlatformType, SyncStatus } from '@common/enums/index.js';

export class CreatorPlatformDto {
  @ApiProperty({
    description: '플랫폼 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @Expose()
  type!: PlatformType;

  @ApiProperty({
    description: '플랫폼별 고유 ID (채널 ID, 사용자명 등)',
    example: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  platformId!: string;

  @ApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  url!: string;

  @ApiPropertyOptional({
    description: '플랫폼별 표시명',
    example: 'MrBeast',
  })
  @Expose()
  displayName?: string;

  @ApiProperty({
    description: '팔로워 수',
    example: 150000000,
  })
  @Expose()
  followerCount!: number;

  @ApiProperty({
    description: '콘텐츠 수',
    example: 500,
  })
  @Expose()
  contentCount!: number;

  @ApiProperty({
    description: '총 조회수',
    example: 25000000000,
  })
  @Expose()
  totalViews!: number;

  @ApiProperty({
    description: '플랫폼 활성 상태',
    example: true,
  })
  @Expose()
  isActive!: boolean;

  @ApiPropertyOptional({
    description: '마지막 동기화 시간',
    example: '2023-12-01T08:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  lastSyncAt?: Date;

  @ApiProperty({
    description: '동기화 상태',
    enum: SyncStatus,
    example: SyncStatus.ACTIVE,
  })
  @Expose()
  syncStatus!: SyncStatus;

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