import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsUrl,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Expose } from 'class-transformer';

import { PlatformType, VerificationProofType } from '../enums/index.js';

export class CreateVerificationProofDto {
  @ApiProperty({
    description: '인증 증명 타입',
    enum: VerificationProofType,
    example: VerificationProofType.SCREENSHOT,
  })
  @Expose()
  @IsEnum(VerificationProofType)
  type!: VerificationProofType;

  @ApiProperty({
    description: '인증 자료 URL',
    example: 'https://example.com/proof.jpg',
  })
  @Expose()
  @IsUrl()
  url!: string;

  @ApiProperty({
    description: '인증 설명',
    example: '채널 관리자 페이지 스크린샷',
    maxLength: 500,
  })
  @Expose()
  @IsString()
  @MaxLength(500)
  description!: string;
}

export class CreatePlatformDataDto {
  @ApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @Expose()
  @IsEnum(PlatformType)
  type!: PlatformType;

  @ApiProperty({
    description: '플랫폼별 고유 ID (채널 ID, 사용자명 등)',
    example: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
    maxLength: 100,
  })
  @Expose()
  @IsString()
  @MaxLength(100)
  platformId!: string;

  @ApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @Expose()
  @IsUrl()
  url!: string;

  @ApiProperty({
    description: '표시명',
    example: 'MrBeast',
    maxLength: 100,
  })
  @Expose()
  @IsString()
  @MaxLength(100)
  displayName!: string;

  @ApiPropertyOptional({
    description: '플랫폼 설명',
    example: 'Gaming content creator specializing in Minecraft and entertainment',
    maxLength: 500,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '현재 팔로워 수',
    example: 150000000,
    minimum: 0,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  @Min(0)
  followerCount?: number;

  @ApiProperty({
    description: '인증 증명 정보',
    type: CreateVerificationProofDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => CreateVerificationProofDto)
  verificationProof!: CreateVerificationProofDto;
}

export class CreatePlatformApplicationDto {
  @ApiProperty({
    description: '신청한 크리에이터 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  @IsString()
  creatorId!: string;

  @ApiProperty({
    description: '플랫폼 데이터',
    type: CreatePlatformDataDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => CreatePlatformDataDto)
  platformData!: CreatePlatformDataDto;
}
