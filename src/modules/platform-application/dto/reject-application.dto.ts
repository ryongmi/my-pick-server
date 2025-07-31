import { IsString, IsOptional, IsArray, MaxLength, IsEnum, ValidateIf } from 'class-validator';
import { Expose } from 'class-transformer';

import { RejectionReason } from '../enums/index.js';

export class RejectApplicationDto {
  @Expose()
  @IsArray()
  @IsEnum(RejectionReason, { each: true })
  reasons!: RejectionReason[]; // 표준화된 거부 사유들 (다중 선택 가능)

  @Expose()
  @ValidateIf(o => o.reasons.includes(RejectionReason.OTHER))
  @IsString()
  @MaxLength(500)
  customReason?: string | undefined; // OTHER 선택 시 필수

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | undefined;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[] | undefined; // 개선이 필요한 요구사항들
}