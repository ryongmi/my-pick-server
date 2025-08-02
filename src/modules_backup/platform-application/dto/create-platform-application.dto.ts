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

import { PlatformType, VerificationProofType } from '../entities/index.js';

export class VerificationProofDto {
  @Expose()
  @IsEnum(VerificationProofType)
  type!: VerificationProofType;

  @Expose()
  @IsUrl()
  url!: string;

  @Expose()
  @IsString()
  @MaxLength(500)
  description!: string;
}

export class CreatePlatformApplicationDto {
  @Expose()
  @IsString()
  creatorId!: string;

  @Expose()
  @ValidateNested()
  @Type(() => PlatformDataDto)
  platformData!: PlatformDataDto;
}

export class PlatformDataDto {
  @Expose()
  @IsEnum(PlatformType)
  type!: PlatformType;

  @Expose()
  @IsString()
  @MaxLength(100)
  platformId!: string;

  @Expose()
  @IsUrl()
  url!: string;

  @Expose()
  @IsString()
  @MaxLength(100)
  displayName!: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Min(0)
  followerCount?: number;

  @Expose()
  @ValidateNested()
  @Type(() => VerificationProofDto)
  verificationProof!: VerificationProofDto;
}