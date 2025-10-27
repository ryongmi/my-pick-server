import { ApiProperty } from '@nestjs/swagger';

import { Expose } from 'class-transformer';

export class UserInteractionStatsDto {
  @ApiProperty({
    description: '총 상호작용 수',
    example: 150,
  })
  @Expose()
  totalInteractions!: number;

  @ApiProperty({
    description: '북마크 수',
    example: 25,
  })
  @Expose()
  bookmarkCount!: number;

  @ApiProperty({
    description: '좋아요 수',
    example: 80,
  })
  @Expose()
  likeCount!: number;
}
