import { IsString, IsEnum, IsOptional } from 'class-validator';

import { ApplicationStatus } from '../enums/index.js';

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED;

  @IsOptional()
  @IsString()
  reason?: string; // 거부 사유 (REJECTED 시 필수)

  @IsOptional()
  @IsString()
  comment?: string; // 검토 코멘트
}
