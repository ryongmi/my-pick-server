import { IsOptional, IsString, IsUrl } from 'class-validator';

import { SwaggerApiProperty } from '@krgeobuk/swagger';

/**
 * 플랫폼 정보 수정 DTO
 */
export class UpdatePlatformDto {
  @SwaggerApiProperty({
    description: '플랫폼 사용자명',
    example: '@channelname',
    required: false,
  })
  @IsOptional()
  @IsString()
  platformUsername?: string;

  @SwaggerApiProperty({
    description: '플랫폼 URL',
    example: 'https://www.youtube.com/channel/UCxxx',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  platformUrl?: string;
}
