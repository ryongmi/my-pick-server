import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsOptional, IsEnum, IsUrl, MaxLength, MinLength } from 'class-validator';

import { PlatformType } from '@common/enums/index.js';

export class CreatePlatformDto {
  @ApiProperty({
    description: '플랫폼 타입',
    example: PlatformType.YOUTUBE,
    enum: PlatformType,
  })
  @IsEnum(PlatformType)
  type!: PlatformType;

  @ApiProperty({
    description: '플랫폼별 고유 ID (채널 ID, 사용자명 등)',
    example: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  platformId!: string;

  @ApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw',
  })
  @IsUrl()
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({
    description: '플랫폼에서의 표시명',
    example: 'PewDiePie',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
