import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Expose } from 'class-transformer';

export class ApproveApplicationDto {
  @Expose()
  @IsString()
  reviewerId!: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | undefined;
}