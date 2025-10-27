import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

import { PlatformType } from '../entities/creator-application.entity.js';

export class CreateApplicationDto {
  @IsEnum(PlatformType)
  platform!: PlatformType;

  @IsString()
  channelId!: string; // YouTube 채널 ID

  @IsUrl()
  channelUrl!: string; // 채널 URL

  @IsOptional()
  @IsString()
  applicantMessage?: string; // 신청 사유/소개
}
