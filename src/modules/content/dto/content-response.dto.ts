/**
 * Creator 정보 (User 정보 포함)
 */
export interface CreatorInfo {
  id: string;
  name: string;
  displayName?: string;
  profileImageUrl?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
}

/**
 * Content with Creator 정보
 */
export interface ContentWithCreatorDto {
  // ==================== Content 기본 정보 ====================
  id: string;
  type: string;
  title: string;
  description?: string;
  thumbnail: string;
  url: string;
  platform: string;
  platformId: string;
  duration?: number;
  publishedAt: string;

  // ==================== 메타데이터 ====================
  language?: string;
  isLive: boolean;
  quality?: 'sd' | 'hd' | '4k';
  ageRestriction: boolean;
  status: string;

  // ==================== JSON 필드 ====================
  statistics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    updatedAt: string;
  };
  syncInfo?: {
    lastSyncedAt?: string;
    expiresAt?: string;
    isAuthorizedData?: boolean;
    syncError?: string;
    syncRetryCount?: number;
    nextSyncAt?: string;
    syncStatus: string;
  };

  // ==================== 타임스탬프 ====================
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  // ==================== Creator 정보 (새로 추가) ====================
  creator: CreatorInfo;
}
