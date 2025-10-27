import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { CreatorPlatformDto } from './creator-platform.dto.js';
import { CreatorConsentDto } from './creator-consent.dto.js';

export class DetailedPlatformStatsDto {
  @ApiProperty({
    description: '총 팔로워 수',
    example: 111000000,
  })
  @Expose()
  totalFollowers!: number;

  @ApiProperty({
    description: '총 콘텐츠 수',
    example: 4500,
  })
  @Expose()
  totalContent!: number;

  @ApiProperty({
    description: '총 조회수',
    example: 28000000000,
  })
  @Expose()
  totalViews!: number;

  @ApiProperty({
    description: '연결된 플랫폼 수',
    example: 3,
  })
  @Expose()
  platformCount!: number;
}

export class CreatorDetailDto {
  @ApiProperty({
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiPropertyOptional({
    description: '연동된 사용자 ID (auth-server)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  userId?: string | null;

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
  avatar?: string | null;

  @ApiPropertyOptional({
    description: '크리에이터 소개',
    example: 'Swedish YouTuber and gamer',
  })
  @Expose()
  description?: string | null;

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
  tags?: string[] | null;

  // ==================== 기본 통계 정보 ====================

  @ApiProperty({
    description: '플랫폼 통계 정보',
    type: DetailedPlatformStatsDto,
  })
  @Expose()
  @Type(() => DetailedPlatformStatsDto)
  platformStats!: DetailedPlatformStatsDto;

  // ==================== 추가 필드 (CreatorEntity 새 필드들) ====================

  @ApiProperty({
    description: '크리에이터 활동 상태',
    enum: ['active', 'inactive', 'suspended', 'banned'],
    example: 'active',
  })
  @Expose()
  status!: 'active' | 'inactive' | 'suspended' | 'banned';

  @ApiProperty({
    description: '검증 상태',
    enum: ['pending', 'verified', 'rejected'],
    example: 'verified',
  })
  @Expose()
  verificationStatus!: 'pending' | 'verified' | 'rejected';

  @ApiPropertyOptional({
    description: '마지막 활동 시간',
    example: '2023-12-01T15:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  lastActivityAt?: Date;

  @ApiPropertyOptional({
    description: '소셜 미디어 링크',
    example: {
      website: 'https://mrbeast.com',
      twitter: 'https://twitter.com/MrBeast',
      instagram: 'https://instagram.com/mrbeast',
      youtube: 'https://youtube.com/@MrBeast',
    },
  })
  @Expose()
  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    discord?: string;
    youtube?: string;
  };

  // ==================== 분리된 엔티티 데이터 ====================

  @ApiPropertyOptional({
    description: '연결된 플랫폼 목록',
    type: [CreatorPlatformDto],
  })
  @Expose()
  @Type(() => CreatorPlatformDto)
  platforms?: CreatorPlatformDto[];

  @ApiPropertyOptional({
    description: '동의 정보 목록',
    type: [CreatorConsentDto],
  })
  @Expose()
  @Type(() => CreatorConsentDto)
  consents?: CreatorConsentDto[];

  // ==================== 고급 통계 정보 제거됨 (MVP에서 불필요) ====================

  // ==================== 타임스탬프 ====================

  @ApiProperty({
    description: '생성일시',
    example: '2023-01-01T00:00:00Z',
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2023-12-01T00:00:00Z',
  })
  @Expose()
  updatedAt!: Date;
}
