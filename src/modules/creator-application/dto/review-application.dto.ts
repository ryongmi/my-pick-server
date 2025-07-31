import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

import { ApplicationStatus } from '../enums/index.js';

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED;

  @IsString()
  reviewerId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];
}