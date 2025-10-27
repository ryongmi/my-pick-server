import { ApiProperty } from '@nestjs/swagger';

import { IsUUID } from 'class-validator';

import { CreatePlatformDto } from './create-platform.dto.js';

/**
 * 내부용 플랫폼 생성 DTO - creatorId 포함
 * 서비스 레이어에서 사용하여 타입 안전성 보장
 */
export class CreatePlatformInternalDto extends CreatePlatformDto {
  @ApiProperty({
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  creatorId!: string;
}
