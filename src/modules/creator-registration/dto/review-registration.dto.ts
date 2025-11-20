import { IsString, IsEnum, IsOptional } from 'class-validator';

import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { RegistrationStatus } from '../enums/index.js';

export class ReviewRegistrationDto {
  @SwaggerApiProperty({
    description: '검토 결과 (APPROVED 또는 REJECTED)',
    enum: [RegistrationStatus.APPROVED, RegistrationStatus.REJECTED],
    example: RegistrationStatus.APPROVED,
  })
  @IsEnum(RegistrationStatus)
  status!: RegistrationStatus.APPROVED | RegistrationStatus.REJECTED;

  @SwaggerApiProperty({
    description: '거부 사유 (REJECTED 시 필수)',
    example: '채널 정보가 부정확합니다.',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @SwaggerApiProperty({
    description: '검토 코멘트',
    example: '승인되었습니다.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
