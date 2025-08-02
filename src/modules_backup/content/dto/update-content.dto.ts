import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;
}

export class UpdateContentStatisticsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  views?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  likes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shares?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  engagementRate?: number;
}