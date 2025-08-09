import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

export class CreatorPlatformStatsDto {
  @ApiProperty({
    description: '플랫폼 타입',
    example: 'youtube',
  })
  @Expose()
  platform!: string;

  @ApiProperty({
    description: '해당 플랫폼 팔로워 수',
    example: 50000000,
  })
  @Expose()
  followers!: number;

  @ApiProperty({
    description: '해당 플랫폼 콘텐츠 수',
    example: 2500,
  })
  @Expose()
  content!: number;

  @ApiProperty({
    description: '해당 플랫폼 총 조회수',
    example: 15000000000,
  })
  @Expose()
  views!: number;

  @ApiProperty({
    description: '해당 플랫폼 참여율 (%)',
    example: 8.5,
  })
  @Expose()
  engagementRate!: number;

  @ApiProperty({
    description: '해당 플랫폼 총 좋아요 수',
    example: 800000000,
  })
  @Expose()
  likes!: number;

  @ApiProperty({
    description: '해당 플랫폼 총 댓글 수',
    example: 120000000,
  })
  @Expose()
  comments!: number;

  @ApiProperty({
    description: '해당 플랫폼 총 공유 수',
    example: 45000000,
  })
  @Expose()
  shares!: number;

  @ApiPropertyOptional({
    description: '해당 플랫폼 평균 조회수',
    example: 6000000.5,
  })
  @Expose()
  averageViews?: number;

  @ApiPropertyOptional({
    description: '통계 마지막 계산 시간',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  lastCalculatedAt?: Date;

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
