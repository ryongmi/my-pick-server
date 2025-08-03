import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentType } from '../entities/creator-consent.entity.js';

export class ConsentHistoryDto {
  @ApiProperty({
    description: '동의 ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id!: string;

  @ApiProperty({
    description: '동의 타입',
    example: ConsentType.DATA_COLLECTION,
    enum: ConsentType,
  })
  type!: ConsentType;

  @ApiProperty({
    description: '동의 여부',
    example: true,
  })
  isGranted!: boolean;

  @ApiProperty({
    description: '동의 승인 시점',
    example: '2024-01-01T00:00:00Z',
  })
  grantedAt!: Date;

  @ApiPropertyOptional({
    description: '동의 철회 시점',
    example: '2024-12-01T00:00:00Z',
  })
  revokedAt?: Date;

  @ApiPropertyOptional({
    description: '동의 만료 시점',
    example: '2024-12-01T00:00:00Z',
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: '동의한 약관/정책 버전',
    example: 'v1.2.0',
  })
  version?: string;

  @ApiProperty({
    description: '동의 생성 시점',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt!: Date;
}