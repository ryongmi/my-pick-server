import { PlatformType, VerificationProofType } from '../enums/index.js';

export interface PlatformData {
  type: PlatformType;
  platformId: string; // 채널 ID, 사용자명 등
  url: string; // 플랫폼 URL
  displayName: string; // 표시명
  description?: string; // 설명
  followerCount?: number; // 현재 팔로워 수
  verificationProof: {
    type: VerificationProofType;
    url: string; // 인증 자료 URL
    description: string; // 인증 설명
  };
}
