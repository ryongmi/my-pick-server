import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { PlatformType } from '../enums/creator-platform.enum.js';

/**
 * 플랫폼 정보 DTO
 */
export class PlatformInfo {
  @SwaggerApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  platformType!: PlatformType;

  @SwaggerApiProperty({
    description: '플랫폼 고유 ID',
    example: 'UCk2NN3Bfbv-dMLKVrx7dAjQ',
  })
  platformId!: string;

  @SwaggerApiProperty({
    description: '플랫폼 사용자명',
    example: '@Ado1024',
    required: false,
  })
  platformUsername?: string;

  @SwaggerApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/@Ado1024',
    required: false,
  })
  platformUrl?: string;
}

/**
 * 크리에이터 검색 결과 DTO
 */
export class CreatorSearchResultDto {
  @SwaggerApiProperty({
    description: '크리에이터 고유 ID',
    example: 'ado',
  })
  id!: string;

  @SwaggerApiProperty({
    description: '크리에이터 이름',
    example: 'Ado',
  })
  name!: string;

  @SwaggerApiProperty({
    description: '크리에이터 소개',
    example: '일본의 유명 가수',
    required: false,
  })
  description?: string;

  @SwaggerApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  profileImageUrl?: string;

  @SwaggerApiProperty({
    description: '활성화 상태',
    example: true,
  })
  isActive!: boolean;

  @SwaggerApiProperty({
    description: '구독자 수',
    example: 5000000,
    required: false,
  })
  subscriberCount?: number;

  @SwaggerApiProperty({
    description: '동영상 수',
    example: 150,
    required: false,
  })
  videoCount?: number;

  @SwaggerApiProperty({
    description: '총 조회수',
    example: 1000000000,
    required: false,
  })
  totalViews?: number;

  @SwaggerApiProperty({
    description: '플랫폼 정보 목록',
    type: [PlatformInfo],
    required: false,
    example: [],
  })
  platforms?: PlatformInfo[];

  @SwaggerApiProperty({
    description: '구독 여부 (로그인 시에만 포함)',
    example: true,
    required: false,
  })
  isSubscribed?: boolean;

  @SwaggerApiProperty({
    description: '생성일시',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt!: Date;
}
