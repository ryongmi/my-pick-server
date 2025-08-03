import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';
import { ConsentType } from '../entities/creator-consent.entity.js';

export class GrantConsentDto {
  @ApiProperty({
    description: '동의 타입',
    example: ConsentType.DATA_COLLECTION,
    enum: ConsentType,
  })
  @IsEnum(ConsentType)
  type!: ConsentType;

  @ApiPropertyOptional({
    description: '동의 만료 시점',
    example: '2024-12-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: '동의 시점의 추가 정보 (IP, User-Agent 등)',
    example: '{"ip": "192.168.1.1", "userAgent": "Mozilla/5.0..."}',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  consentData?: string;

  @ApiPropertyOptional({
    description: '동의한 약관/정책 버전',
    example: 'v1.2.0',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;
}