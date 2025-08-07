import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { ConsentType } from '../entities/index.js';

export class CreatorConsentDto {
  @ApiProperty({
    description: '동의 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '동의 타입',
    enum: ConsentType,
    example: ConsentType.DATA_COLLECTION,
  })
  @Expose()
  type!: ConsentType;

  @ApiProperty({
    description: '동의 여부',
    example: true,
  })
  @Expose()
  isGranted!: boolean;

  @ApiProperty({
    description: '동의 시간',
    example: '2023-01-15T10:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  grantedAt!: Date;

  @ApiPropertyOptional({
    description: '동의 철회 시간',
    example: '2023-12-01T15:20:00Z',
  })
  @Expose()
  @Type(() => Date)
  revokedAt?: Date;

  @ApiPropertyOptional({
    description: '동의 만료 시간',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: '동의한 약관/정책 버전',
    example: '1.2.0',
  })
  @Expose()
  version?: string;

  @ApiProperty({
    description: '생성일시',
    example: '2023-01-01T00:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2023-12-01T00:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}