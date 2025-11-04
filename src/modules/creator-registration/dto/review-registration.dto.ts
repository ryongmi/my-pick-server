import { IsString, IsEnum, IsOptional } from 'class-validator';

import { RegistrationStatus } from '../enums/index.js';

export class ReviewRegistrationDto {
  @IsEnum(RegistrationStatus)
  status!: RegistrationStatus.APPROVED | RegistrationStatus.REJECTED;

  @IsOptional()
  @IsString()
  reason?: string; // 거부 사유 (REJECTED 시 필수)

  @IsOptional()
  @IsString()
  comment?: string; // 검토 코멘트
}
