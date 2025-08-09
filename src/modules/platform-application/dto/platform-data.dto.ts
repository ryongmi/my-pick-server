import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { PlatformType, VerificationProofType } from '../enums/index.js';

export class VerificationProofDto {
  @ApiProperty({
    description: '인증 증명 타입',
    enum: VerificationProofType,
    example: VerificationProofType.SCREENSHOT,
  })
  @Expose()
  type!: VerificationProofType;

  @ApiProperty({
    description: '인증 자료 URL',
    example: 'https://example.com/proof.jpg',
  })
  @Expose()
  url!: string;

  @ApiProperty({
    description: '인증 설명',
    example: '채널 관리자 페이지 스크린샷',
  })
  @Expose()
  description!: string;
}

export class PlatformDataDto {
  @ApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @Expose()
  type!: PlatformType;

  @ApiProperty({
    description: '플랫폼별 고유 ID (채널 ID, 사용자명 등)',
    example: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  platformId!: string;

  @ApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  url!: string;

  @ApiProperty({
    description: '표시명',
    example: 'MrBeast',
  })
  @Expose()
  displayName!: string;

  @ApiPropertyOptional({
    description: '플랫폼 설명',
    example: 'Gaming content creator specializing in Minecraft and entertainment',
  })
  @Expose()
  description?: string;

  @ApiPropertyOptional({
    description: '현재 팔로워 수',
    example: 150000000,
  })
  @Expose()
  followerCount?: number;

  @ApiProperty({
    description: '인증 증명 정보',
    type: VerificationProofDto,
  })
  @Expose()
  @Type(() => VerificationProofDto)
  verificationProof!: VerificationProofDto;

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
