import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, Min } from 'class-validator';

export class UpdateCreatorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  followerCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  contentCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalViews?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}