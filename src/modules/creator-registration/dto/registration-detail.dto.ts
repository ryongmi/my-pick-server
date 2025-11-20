import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { PlatformType } from '@modules/creator/enums/index.js';

import { ChannelInfo, ReviewInfo } from '../entities/creator-registration.entity.js';
import { RegistrationStatus } from '../enums/index.js';

export class ChannelInfoDto implements ChannelInfo {
  @SwaggerApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  platform!: PlatformType;

  @SwaggerApiProperty({
    description: '채널 ID',
    example: 'UCk2NN3Bfbv-dMLKVrx7dAjQ',
  })
  channelId!: string;

  @SwaggerApiProperty({
    description: '채널 URL',
    example: 'https://www.youtube.com/@Ado1024',
  })
  channelUrl!: string;

  @SwaggerApiProperty({
    description: '채널 이름',
    example: 'Ado',
  })
  channelName!: string;

  @SwaggerApiProperty({
    description: '구독자 수',
    example: 5000000,
    required: false,
  })
  subscriberCount?: number;

  @SwaggerApiProperty({
    description: '영상 수',
    example: 120,
    required: false,
  })
  videoCount?: number;

  @SwaggerApiProperty({
    description: '채널 설명',
    example: 'Ado Official YouTube Channel',
    required: false,
  })
  description?: string;

  @SwaggerApiProperty({
    description: '썸네일 URL',
    example: 'https://yt3.ggpht.com/example.jpg',
    required: false,
  })
  thumbnailUrl?: string;

  @SwaggerApiProperty({
    description: '커스텀 URL',
    example: '@Ado1024',
    required: false,
  })
  customUrl?: string;

  @SwaggerApiProperty({
    description: '국가',
    example: 'JP',
    required: false,
  })
  country?: string;

  @SwaggerApiProperty({
    description: '채널 생성일',
    example: '2020-09-10T12:00:00Z',
    required: false,
  })
  publishedAt?: string;
}

export class ReviewInfoDto implements ReviewInfo {
  @SwaggerApiProperty({
    description: '검토자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  reviewerId?: string;

  @SwaggerApiProperty({
    description: '검토 완료 시간',
    example: '2025-01-15T10:30:00Z',
    required: false,
  })
  reviewedAt?: string;

  @SwaggerApiProperty({
    description: '거부 사유',
    example: null,
    required: false,
  })
  reason?: string;

  @SwaggerApiProperty({
    description: '검토 코멘트',
    example: '승인되었습니다.',
    required: false,
  })
  comment?: string;
}

export class RegistrationDetailDto {
  @SwaggerApiProperty({
    description: '신청 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @SwaggerApiProperty({
    description: '신청자 사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId!: string;

  @SwaggerApiProperty({
    description: '채널 정보',
    type: ChannelInfoDto,
    example: {},
  })
  channelInfo!: ChannelInfo;

  @SwaggerApiProperty({
    description: '신청 상태',
    enum: RegistrationStatus,
    example: RegistrationStatus.PENDING,
  })
  status!: RegistrationStatus;

  @SwaggerApiProperty({
    description: '신청 일시',
    example: '2025-01-15T09:00:00Z',
  })
  appliedAt!: Date;

  @SwaggerApiProperty({
    description: '신청 메시지',
    example: 'Ado의 공식 채널입니다.',
    required: false,
  })
  registrationMessage?: string;

  @SwaggerApiProperty({
    description: '검토 정보',
    type: ReviewInfoDto,
    example: null,
    required: false,
  })
  reviewInfo?: ReviewInfo;

  @SwaggerApiProperty({
    description: '생성된 크리에이터 ID (승인 시)',
    example: 'ado',
    required: false,
  })
  createdCreatorId?: string;

  @SwaggerApiProperty({
    description: '생성 시간',
    example: '2025-01-15T09:00:00Z',
  })
  createdAt!: Date;

  @SwaggerApiProperty({
    description: '수정 시간',
    example: '2025-01-15T09:00:00Z',
  })
  updatedAt!: Date;
}

