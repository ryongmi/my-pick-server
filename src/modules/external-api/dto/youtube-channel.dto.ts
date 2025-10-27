import { IsString, IsNumber, IsDate, IsOptional, ValidateNested } from 'class-validator';
import { Type, Expose } from 'class-transformer';

export class YouTubeChannelThumbnailsDto {
  @Expose()
  @IsOptional()
  @IsString()
  default?: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  medium?: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  high?: string | null;
}

export class YouTubeChannelStatisticsDto {
  @Expose()
  @IsNumber()
  viewCount!: number;

  @Expose()
  @IsNumber()
  subscriberCount!: number;

  @Expose()
  @IsNumber()
  videoCount!: number;
}

export class YouTubeChannelBrandingSettingsDto {
  @Expose()
  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @Expose()
  @IsOptional()
  @IsString()
  keywords?: string;

  @Expose()
  @IsOptional()
  @IsString()
  country?: string;
}

export class YouTubeChannelDto {
  @Expose()
  @IsString()
  id!: string;

  @Expose()
  @IsString()
  title!: string;

  @Expose()
  @IsString()
  description!: string;

  @Expose()
  @IsOptional()
  @IsString()
  customUrl?: string;

  @Expose()
  @IsDate()
  @Type(() => Date)
  publishedAt!: Date;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeChannelThumbnailsDto)
  thumbnails!: YouTubeChannelThumbnailsDto;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeChannelStatisticsDto)
  statistics!: YouTubeChannelStatisticsDto;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeChannelBrandingSettingsDto)
  brandingSettings!: YouTubeChannelBrandingSettingsDto;
}
