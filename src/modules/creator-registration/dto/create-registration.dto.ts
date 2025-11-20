import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { PlatformType } from '@modules/creator/enums/index.js';

export class CreateRegistrationDto {
  @SwaggerApiProperty({
    description: '플랫폼 타입',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
  })
  @IsEnum(PlatformType)
  platform!: PlatformType;

  @SwaggerApiProperty({
    description: '채널 ID (YouTube 채널 ID 등)',
    example: 'UCk2NN3Bfbv-dMLKVrx7dAjQ',
  })
  @IsString()
  channelId!: string;

  @SwaggerApiProperty({
    description: '채널 URL',
    example: 'https://www.youtube.com/@Ado1024',
  })
  @IsUrl()
  channelUrl!: string;

  @SwaggerApiProperty({
    description: '신청 사유 또는 소개',
    example: 'Ado의 공식 채널입니다. 크리에이터로 등록을 희망합니다.',
    required: false,
  })
  @IsOptional()
  @IsString()
  registrationMessage?: string;
}

