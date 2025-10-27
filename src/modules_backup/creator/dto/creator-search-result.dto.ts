import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

class PlatformStatsDto {
  @ApiProperty({
    description: '총 팔로워 수',
    example: 111000000,
  })
  @Expose()
  totalFollowers!: number;

  @ApiProperty({
    description: '연결된 플랫폼 수',
    example: 3,
  })
  @Expose()
  platformCount!: number;
}

export class CreatorSearchResultDto {
  @ApiProperty({
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '크리에이터 실명',
    example: 'Felix Kjellberg',
  })
  @Expose()
  name!: string;

  @ApiProperty({
    description: '표시명',
    example: 'PewDiePie',
  })
  @Expose()
  displayName!: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/avatar.jpg',
  })
  @Expose()
  avatar?: string | null | undefined;

  @ApiPropertyOptional({
    description: '크리에이터 소개',
    example: 'Swedish YouTuber and gamer',
  })
  @Expose()
  description?: string | null | undefined;

  @ApiProperty({
    description: '인증 여부',
    example: true,
  })
  @Expose()
  isVerified!: boolean;

  @ApiProperty({
    description: '카테고리',
    example: 'gaming',
  })
  @Expose()
  category!: string;

  @ApiPropertyOptional({
    description: '태그 목록',
    example: ['gaming', 'minecraft', 'comedy'],
    type: [String],
  })
  @Expose()
  tags?: string[] | null | undefined;

  @ApiPropertyOptional({
    description: '플랫폼 통계 정보',
    type: PlatformStatsDto,
  })
  @Expose()
  @Type(() => PlatformStatsDto)
  platformStats?: PlatformStatsDto;

  @ApiProperty({
    description: '생성일시',
    example: '2023-01-01T00:00:00Z',
  })
  @Expose()
  createdAt!: Date;
}
