import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min, Max } from 'class-validator';

export class BookmarkContentDto {
  @IsString()
  userId!: string;

  @IsString()
  contentId!: string;
}

export class LikeContentDto {
  @IsString()
  userId!: string;

  @IsString()
  contentId!: string;
}

export class WatchContentDto {
  @IsString()
  userId!: string;

  @IsString()
  contentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  watchDuration?: number | undefined;
}

export class RateContentDto {
  @IsString()
  userId!: string;

  @IsString()
  contentId!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;
}

export class UpdateInteractionDto {
  @IsOptional()
  @IsBoolean()
  isBookmarked?: boolean | undefined;

  @IsOptional()
  @IsBoolean()
  isLiked?: boolean | undefined;

  @IsOptional()
  @IsDateString()
  watchedAt?: string | undefined;

  @IsOptional()
  @IsNumber()
  @Min(0)
  watchDuration?: number | undefined;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number | undefined;
}