import { Expose, Type } from 'class-transformer';

// ==================== 공통 타입들 ====================

export class TwitterEntityUrlDto {
  @Expose()
  start!: number;

  @Expose()
  end!: number;

  @Expose()
  url!: string;

  @Expose()
  expanded_url!: string;

  @Expose()
  display_url!: string;
}

export class TwitterHashtagDto {
  @Expose()
  start!: number;

  @Expose()
  end!: number;

  @Expose()
  tag!: string;
}

export class TwitterMentionDto {
  @Expose()
  start!: number;

  @Expose()
  end!: number;

  @Expose()
  username!: string;

  @Expose()
  id!: string;
}

export class TwitterCashtagDto {
  @Expose()
  start!: number;

  @Expose()
  end!: number;

  @Expose()
  tag!: string;
}

// ==================== TwitterUser 관련 DTO ====================

export class TwitterUserPublicMetricsDto {
  @Expose()
  followersCount!: number;

  @Expose()
  followingCount!: number;

  @Expose()
  tweetCount!: number;

  @Expose()
  listedCount!: number;
}

export class TwitterUserUrlEntitiesDto {
  @Expose()
  @Type(() => TwitterEntityUrlDto)
  urls!: TwitterEntityUrlDto[];
}

export class TwitterUserDescriptionEntitiesDto {
  @Expose()
  @Type(() => TwitterEntityUrlDto)
  urls!: TwitterEntityUrlDto[];
}

export class TwitterUserEntitiesDto {
  @Expose()
  @Type(() => TwitterUserUrlEntitiesDto)
  url?: TwitterUserUrlEntitiesDto | undefined;

  @Expose()
  @Type(() => TwitterUserDescriptionEntitiesDto)
  description?: TwitterUserDescriptionEntitiesDto | undefined;
}

// ==================== TwitterTweet 관련 DTO ====================

export class TwitterTweetAuthorDto {
  @Expose()
  id!: string;

  @Expose()
  username!: string;

  @Expose()
  name!: string;

  @Expose()
  profileImageUrl?: string | undefined;
}

export class TwitterTweetPublicMetricsDto {
  @Expose()
  retweetCount!: number;

  @Expose()
  likeCount!: number;

  @Expose()
  replyCount!: number;

  @Expose()
  quoteCount!: number;
}

export class TwitterReferencedTweetDto {
  @Expose()
  type!: 'retweeted' | 'quoted' | 'replied_to';

  @Expose()
  id!: string;
}

export class TwitterTweetEntitiesDto {
  @Expose()
  @Type(() => TwitterEntityUrlDto)
  urls!: TwitterEntityUrlDto[];

  @Expose()
  @Type(() => TwitterHashtagDto)
  hashtags!: TwitterHashtagDto[];

  @Expose()
  @Type(() => TwitterMentionDto)
  mentions!: TwitterMentionDto[];

  @Expose()
  @Type(() => TwitterCashtagDto)
  cashtags!: TwitterCashtagDto[];
}

export class TwitterMediaDto {
  @Expose()
  mediaKey!: string;

  @Expose()
  type!: 'photo' | 'video' | 'animated_gif';

  @Expose()
  url?: string | undefined;

  @Expose()
  previewImageUrl?: string | undefined;

  @Expose()
  width?: number | undefined;

  @Expose()
  height?: number | undefined;

  @Expose()
  durationMs?: number | undefined;
}

export class TwitterAttachmentsDto {
  @Expose()
  mediaKeys!: string[];

  @Expose()
  @Type(() => TwitterMediaDto)
  media!: TwitterMediaDto[];
}

// ==================== 메인 DTO 클래스들 ====================

export class TwitterUserDto {
  @Expose()
  id!: string;

  @Expose()
  username!: string;

  @Expose()
  name!: string;

  @Expose()
  description!: string;

  @Expose()
  location?: string | undefined;

  @Expose()
  url?: string | undefined;

  @Expose()
  profileImageUrl?: string | undefined;

  @Expose()
  protected!: boolean;

  @Expose()
  verified!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  pinnedTweetId?: string | undefined;

  @Expose()
  @Type(() => TwitterUserPublicMetricsDto)
  publicMetrics!: TwitterUserPublicMetricsDto;

  @Expose()
  @Type(() => TwitterUserEntitiesDto)
  entities!: TwitterUserEntitiesDto;
}

export class TwitterTweetDto {
  @Expose()
  id!: string;

  @Expose()
  text!: string;

  @Expose()
  authorId!: string;

  @Expose()
  @Type(() => TwitterTweetAuthorDto)
  author?: TwitterTweetAuthorDto | undefined;

  @Expose()
  createdAt!: Date;

  @Expose()
  lang?: string | undefined;

  @Expose()
  source?: string | undefined;

  @Expose()
  inReplyToUserId?: string | undefined;

  @Expose()
  replySettings?: string | undefined;

  @Expose()
  @Type(() => TwitterTweetPublicMetricsDto)
  publicMetrics!: TwitterTweetPublicMetricsDto;

  @Expose()
  @Type(() => TwitterReferencedTweetDto)
  referencedTweets!: TwitterReferencedTweetDto[];

  @Expose()
  @Type(() => TwitterTweetEntitiesDto)
  entities!: TwitterTweetEntitiesDto;

  @Expose()
  @Type(() => TwitterAttachmentsDto)
  attachments!: TwitterAttachmentsDto;

  @Expose()
  url!: string;
}

export class TwitterSearchResultDto {
  @Expose()
  tweets!: TwitterTweetDto[];

  @Expose()
  nextToken?: string | undefined;

  @Expose()
  resultCount!: number;
}
