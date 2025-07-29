import { Expose } from 'class-transformer';

export class TwitterUserDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  location?: string;

  @Expose()
  url?: string;

  @Expose()
  profileImageUrl?: string;

  @Expose()
  protected: boolean;

  @Expose()
  verified: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  pinnedTweetId?: string;

  @Expose()
  publicMetrics: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
  };

  @Expose()
  entities: {
    url?: {
      urls: Array<{
        start: number;
        end: number;
        url: string;
        expanded_url: string;
        display_url: string;
      }>;
    };
    description?: {
      urls: Array<{
        start: number;
        end: number;
        url: string;
        expanded_url: string;
        display_url: string;
      }>;
    };
  };
}

export class TwitterTweetDto {
  @Expose()
  id: string;

  @Expose()
  text: string;

  @Expose()
  authorId: string;

  @Expose()
  author?: {
    id: string;
    username: string;
    name: string;
    profileImageUrl?: string;
  };

  @Expose()
  createdAt: Date;

  @Expose()
  lang?: string;

  @Expose()
  source?: string;

  @Expose()
  inReplyToUserId?: string;

  @Expose()
  replySettings?: string;

  @Expose()
  publicMetrics: {
    retweetCount: number;
    likeCount: number;
    replyCount: number;
    quoteCount: number;
  };

  @Expose()
  referencedTweets: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;

  @Expose()
  entities: {
    urls: Array<{
      start: number;
      end: number;
      url: string;
      expanded_url: string;
      display_url: string;
    }>;
    hashtags: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    mentions: Array<{
      start: number;
      end: number;
      username: string;
      id: string;
    }>;
    cashtags: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
  };

  @Expose()
  attachments: {
    mediaKeys: string[];
    media: Array<{
      mediaKey: string;
      type: 'photo' | 'video' | 'animated_gif';
      url?: string;
      previewImageUrl?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    }>;
  };

  @Expose()
  url: string;
}

export class TwitterSearchResultDto {
  @Expose()
  tweets: TwitterTweetDto[];

  @Expose()
  nextToken?: string;

  @Expose()
  resultCount: number;
}