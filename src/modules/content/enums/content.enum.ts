export enum ContentType {
  YOUTUBE_VIDEO = 'youtube_video',
  TWITTER_POST = 'twitter_post',
  INSTAGRAM_POST = 'instagram_post',
  TIKTOK_VIDEO = 'tiktok_video',
}

export enum ContentSyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ContentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_REVIEW = 'under_review',
  FLAGGED = 'flagged',
  REMOVED = 'removed',
}

export enum ContentQuality {
  SD = 'sd',
  HD = 'hd',
  _4K = '4k',
}
