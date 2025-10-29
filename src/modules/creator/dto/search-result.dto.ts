/**
 * 플랫폼 정보 DTO
 */
export interface PlatformInfo {
  platformType: 'youtube' | 'twitter';
  platformId: string;
  platformUsername?: string;
  platformUrl?: string;
}

/**
 * 크리에이터 검색 결과 DTO
 */
export class CreatorSearchResultDto {
  id!: string;
  name!: string;
  description?: string;
  profileImageUrl?: string;
  isActive!: boolean;

  // 통계 정보
  subscriberCount?: number;
  videoCount?: number;
  totalViews?: number;

  // 플랫폼 정보
  platforms?: PlatformInfo[];

  createdAt!: Date;
}
