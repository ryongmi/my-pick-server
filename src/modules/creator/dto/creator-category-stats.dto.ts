import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CreatorCategoryStatsDto {
  @ApiProperty({
    description: '카테고리',
    example: 'gaming',
  })
  @Expose()
  category!: string;

  @ApiProperty({
    description: '해당 카테고리 콘텐츠 수',
    example: 1500,
  })
  @Expose()
  contentCount!: number;

  @ApiProperty({
    description: '해당 카테고리 총 조회수',
    example: 8000000000,
  })
  @Expose()
  viewCount!: number;

  @ApiProperty({
    description: '해당 카테고리 평균 조회수',
    example: 5333333.33,
  })
  @Expose()
  averageViews!: number;

  @ApiProperty({
    description: '해당 카테고리 총 좋아요 수',
    example: 400000000,
  })
  @Expose()
  totalLikes!: number;

  @ApiProperty({
    description: '해당 카테고리 총 댓글 수',
    example: 60000000,
  })
  @Expose()
  totalComments!: number;

  @ApiProperty({
    description: '해당 카테고리 총 공유 수',
    example: 22000000,
  })
  @Expose()
  totalShares!: number;

  @ApiProperty({
    description: '해당 카테고리 평균 참여율 (%)',
    example: 7.8,
  })
  @Expose()
  averageEngagementRate!: number;

  @ApiProperty({
    description: '해당 카테고리 콘텐츠 성장률 (월간 %)',
    example: 12.5,
  })
  @Expose()
  contentGrowthRate!: number;

  @ApiProperty({
    description: '해당 카테고리 조회수 성장률 (월간 %)',
    example: 15.2,
  })
  @Expose()
  viewGrowthRate!: number;

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