import { IsString, IsNumber, IsDate, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type, Expose } from 'class-transformer';

export class YouTubeVideoThumbnailsDto {
  @Expose()
  @IsOptional()
  @IsString()
  default?: string;

  @Expose()
  @IsOptional()
  @IsString()
  medium?: string;

  @Expose()
  @IsOptional()
  @IsString()
  high?: string;

  @Expose()
  @IsOptional()
  @IsString()
  standard?: string;

  @Expose()
  @IsOptional()
  @IsString()
  maxres?: string;
}

export class YouTubeVideoStatisticsDto {
  @Expose()
  @IsNumber()
  viewCount!: number;

  @Expose()
  @IsNumber()
  likeCount!: number;

  @Expose()
  @IsNumber()
  commentCount!: number;
}

export class YouTubeVideoDto {
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
  @IsDate()
  @Type(() => Date)
  publishedAt!: Date;

  @Expose()
  @IsString()
  channelId!: string;

  @Expose()
  @IsString()
  channelTitle!: string;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeVideoThumbnailsDto)
  thumbnails!: YouTubeVideoThumbnailsDto;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeVideoStatisticsDto)
  statistics!: YouTubeVideoStatisticsDto;

  @Expose()
  @IsNumber()
  duration!: number; // seconds

  @Expose()
  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @Expose()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  liveBroadcastContent?: string;

  @Expose()
  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @Expose()
  @IsString()
  url!: string;
}
