import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { RejectionReason } from '../enums/index.js';

export class ReviewDataDto {
  @ApiPropertyOptional({
    description: '표준화된 거부 사유들 (다중 선택 가능)',
    enum: RejectionReason,
    isArray: true,
    example: [RejectionReason.INSUFFICIENT_FOLLOWERS, RejectionReason.INAPPROPRIATE_CONTENT],
  })
  @Expose()
  reasons?: RejectionReason[];

  @ApiPropertyOptional({
    description: '기타 사유일 때의 상세 설명',
    example: '콘텐츠 품질이 기준에 미달합니다.',
  })
  @Expose()
  customReason?: string;

  @ApiPropertyOptional({
    description: '관리자 코멘트',
    example: '좋은 콘텐츠를 제작하고 있으나, 구독자 수 기준을 충족해주세요.',
  })
  @Expose()
  comment?: string;

  @ApiPropertyOptional({
    description: '추가 요구사항 목록',
    example: ['구독자 수 10만 달성', '월 5개 이상 영상 업로드', '커뮤니티 가이드라인 준수'],
    type: [String],
  })
  @Expose()
  requirements?: string[];

  @ApiPropertyOptional({
    description: '기존 호환성을 위한 거부 사유 (deprecated)',
    example: '구독자 수 기준 미달',
    deprecated: true,
  })
  @Expose()
  reason?: string;

  @ApiProperty({
    description: '생성일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
