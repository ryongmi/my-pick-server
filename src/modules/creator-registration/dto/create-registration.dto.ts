import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

import { PlatformType } from '../entities/creator-registration.entity.js';

export class CreateRegistrationDto {
  @IsEnum(PlatformType)
  platform!: PlatformType;

  @IsString()
  channelId!: string; // YouTube 채널 ID

  @IsUrl()
  channelUrl!: string; // 채널 URL

  @IsOptional()
  @IsString()
  registrationMessage?: string; // 신청 사유/소개
}
