import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { ApplicationStatus } from '../enums/index.js';

export class ChannelInfoDto {
  @ApiProperty({
    description: '플랫폼 타입',
    example: 'youtube',
  })
  @Expose()
  platform!: string;

  @ApiProperty({
    description: '채널 ID',
    example: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  channelId!: string;

  @ApiProperty({
    description: '채널 URL',
    example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  channelUrl!: string;

  @ApiProperty({
    description: '구독자 수',
    example: 150000000,
  })
  @Expose()
  subscriberCount!: number;

  @ApiProperty({
    description: '콘텐츠 카테고리',
    example: 'gaming',
  })
  @Expose()
  contentCategory!: string;

  @ApiProperty({
    description: '채널 설명',
    example: 'Gaming content creator specializing in Minecraft and entertainment',
  })
  @Expose()
  description!: string;
}

export class SampleVideoDto {
  @ApiProperty({
    description: '샘플 영상 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '영상 제목',
    example: 'Minecraft: Building the Ultimate Castle',
  })
  @Expose()
  title!: string;

  @ApiProperty({
    description: '영상 URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @Expose()
  url!: string;

  @ApiProperty({
    description: '조회수',
    example: 25000000,
  })
  @Expose()
  views!: number;

  @ApiProperty({
    description: '정렬 순서',
    example: 1,
  })
  @Expose()
  sortOrder!: number;
}

export class ReviewDto {
  @ApiPropertyOptional({
    description: '검토 사유',
    example: '구독자 수 기준 미달',
  })
  @Expose()
  reason?: string;

  @ApiPropertyOptional({
    description: '검토 코멘트',
    example: '좋은 콘텐츠를 제작하고 있으나, 최소 구독자 수 기준을 충족해주세요.',
  })
  @Expose()
  comment?: string;

  @ApiPropertyOptional({
    description: '추가 요구사항 목록',
    example: ['구독자 수 100만 달성', '월 10개 이상 영상 업로드'],
    type: [String],
  })
  @Expose()
  requirements?: string[];
}

export class NormalizedApplicationDetailDto {
  @ApiProperty({
    description: '신청서 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '신청자 사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  userId!: string;

  @ApiProperty({
    description: '신청 상태',
    enum: ApplicationStatus,
    example: ApplicationStatus.PENDING,
  })
  @Expose()
  status!: ApplicationStatus;

  @ApiProperty({
    description: '신청일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  appliedAt!: Date;

  @ApiPropertyOptional({
    description: '검토 완료일시',
    example: '2023-12-05T14:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: '검토자 ID',
    example: '789a0123-4567-890b-cdef-123456789012',
  })
  @Expose()
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '채널 정보',
    type: ChannelInfoDto,
  })
  @Expose()
  @Type(() => ChannelInfoDto)
  channelInfo?: ChannelInfoDto;

  @ApiPropertyOptional({
    description: '샘플 영상 목록',
    type: [SampleVideoDto],
  })
  @Expose()
  @Type(() => SampleVideoDto)
  sampleVideos?: SampleVideoDto[];

  @ApiPropertyOptional({
    description: '검토 정보',
    type: ReviewDto,
  })
  @Expose()
  @Type(() => ReviewDto)
  review?: ReviewDto;
}
