import { Expose, Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsDate, IsArray, ValidateNested } from 'class-validator';

import { YouTubeChannelBasicSnippet, YouTubeSearchSnippet } from '../interfaces/index.js';

export class YouTubeChannelThumbnailsDto {
  @Expose()
  @IsOptional()
  @IsString()
  default?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  medium?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  high?: string | undefined;
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
  bannerImageUrl?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  keywords?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  country?: string | undefined;
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
  customUrl?: string | undefined;

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
  @IsOptional()
  @ValidateNested()
  @Type(() => YouTubeChannelBrandingSettingsDto)
  brandingSettings?: YouTubeChannelBrandingSettingsDto;
}

export class YouTubeVideoThumbnailsDto {
  @Expose()
  @IsOptional()
  @IsString()
  default?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  medium?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  high?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  standard?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  maxres?: string | undefined;
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
  duration!: number; // 초 단위

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

export class YouTubePlaylistThumbnailsDto {
  @Expose()
  @IsOptional()
  @IsString()
  default?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  medium?: string | undefined;

  @Expose()
  @IsOptional()
  @IsString()
  high?: string | undefined;
}

export class YouTubePlaylistDto {
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
  @IsString()
  channelId!: string;

  @Expose()
  @IsString()
  channelTitle!: string;

  @Expose()
  @IsDate()
  @Type(() => Date)
  publishedAt!: Date;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubePlaylistThumbnailsDto)
  thumbnails!: YouTubePlaylistThumbnailsDto;

  @Expose()
  @IsNumber()
  itemCount!: number;
}

export class YouTubeSearchResultDto {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YouTubeVideoDto)
  videos!: YouTubeVideoDto[];

  @Expose()
  @IsOptional()
  @IsString()
  nextPageToken?: string | undefined;

  @Expose()
  @IsNumber()
  totalResults!: number;
}

// ==================== API 응답 검증용 DTO ====================


export class YouTubeChannelBasicDto {
  @Expose()
  @IsString()
  id!: string;

  @Expose()
  @ValidateNested()
  @Type(() => Object)
  snippet!: YouTubeChannelBasicSnippet;
}

export class YouTubeChannelSnippetApiDto {
  @Expose()
  @IsString()
  title!: string;

  @Expose()
  @IsString()
  description!: string;

  @Expose()
  @IsOptional()
  @IsString()
  customUrl?: string | undefined;

  @Expose()
  @IsString()
  publishedAt!: string;

  @Expose()
  @ValidateNested()
  @Type(() => Object)
  thumbnails!: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

export class YouTubeChannelStatisticsApiDto {
  @Expose()
  @IsString()
  viewCount!: string;

  @Expose()
  @IsString()
  subscriberCount!: string;

  @Expose()
  @IsString()
  videoCount!: string;
}

export class YouTubeChannelBrandingSettingsApiDto {
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  image?: {
    bannerExternalUrl?: string;
  };

  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  channel?: {
    keywords?: string;
    country?: string;
  };
}

export class YouTubeChannelFullDto {
  @Expose()
  @IsString()
  id!: string;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeChannelSnippetApiDto)
  snippet!: YouTubeChannelSnippetApiDto;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeChannelStatisticsApiDto)
  statistics!: YouTubeChannelStatisticsApiDto;

  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => YouTubeChannelBrandingSettingsApiDto)
  brandingSettings?: YouTubeChannelBrandingSettingsApiDto;
}

export class YouTubeRelatedPlaylistsDto {
  @Expose()
  @IsString()
  uploads!: string;
}

export class YouTubeContentDetailsDto {
  @Expose()
  @ValidateNested()
  @Type(() => YouTubeRelatedPlaylistsDto)
  relatedPlaylists!: YouTubeRelatedPlaylistsDto;
}

export class YouTubeChannelContentDto {
  @Expose()
  @IsString()
  id!: string;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubeContentDetailsDto)
  contentDetails!: YouTubeContentDetailsDto;
}

export class YouTubeSearchIdDto {
  @Expose()
  @IsString()
  videoId!: string;
}


export class YouTubeSearchItemDto {
  @Expose()
  @ValidateNested()
  @Type(() => YouTubeSearchIdDto)
  id!: YouTubeSearchIdDto;

  @Expose()
  snippet!: YouTubeSearchSnippet;
}

export class YouTubePageInfoDto {
  @Expose()
  @IsNumber()
  totalResults!: number;
}

export class YouTubeSearchApiResponseDto {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YouTubeSearchItemDto)
  items!: YouTubeSearchItemDto[];

  @Expose()
  @IsOptional()
  @IsString()
  nextPageToken?: string | undefined;

  @Expose()
  @ValidateNested()
  @Type(() => YouTubePageInfoDto)
  pageInfo!: YouTubePageInfoDto;
}

export class YouTubeChannelsApiResponseDto {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YouTubeChannelBasicDto)
  items!: YouTubeChannelBasicDto[];
}

export class YouTubeChannelContentApiResponseDto {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YouTubeChannelContentDto)
  items!: YouTubeChannelContentDto[];
}

export class YouTubeChannelFullApiResponseDto {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YouTubeChannelFullDto)
  items!: YouTubeChannelFullDto[];
}

