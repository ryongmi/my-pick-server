import { PlatformType } from '@common/enums/index.js';

import { YouTubeVideoDto } from '../dto/youtube-video.dto.js';
import { ContentType, ContentQuality, ContentCategorySource } from '../../content/enums/index.js';
import type { CreateContentInput } from '../../content/services/content.service.js';
import type { AddCategoryDto } from '../../content/services/content-category.service.js';

/**
 * YouTube API DTO를 Content 생성 DTO로 변환
 * (CreateContentInput의 alias)
 */

/**
 * YouTube 비디오를 Content 생성 DTO로 변환
 */
export function mapYouTubeVideoToContent(
  video: YouTubeVideoDto,
  creatorId: string
): CreateContentInput {
  const result: CreateContentInput = {
    type: ContentType.YOUTUBE_VIDEO,
    title: video.title,
    ...(video.description ? { description: video.description } : {}),
    thumbnail: video.thumbnails.high || video.thumbnails.medium || video.thumbnails.default || '',
    url: video.url,
    platform: PlatformType.YOUTUBE,
    platformId: video.id,
    duration: video.duration,
    publishedAt: video.publishedAt,
    creatorId,
    ...(video.defaultLanguage ? { language: video.defaultLanguage } : {}),
    isLive: video.liveBroadcastContent === 'live',
    quality: determineVideoQuality(video.thumbnails),
    ageRestriction: false, // YouTube API는 연령 제한 정보를 제공하지 않음
  };

  return result;
}

/**
 * YouTube 카테고리 매핑
 */
export function mapYouTubeCategoryToContentCategory(
  contentId: string,
  categoryId?: string
): AddCategoryDto | null {
  if (!categoryId) return null;

  const categoryMap: Record<string, string> = {
    '1': 'Film & Animation',
    '2': 'Autos & Vehicles',
    '10': 'Music',
    '15': 'Pets & Animals',
    '17': 'Sports',
    '19': 'Travel & Events',
    '20': 'Gaming',
    '22': 'People & Blogs',
    '23': 'Comedy',
    '24': 'Entertainment',
    '25': 'News & Politics',
    '26': 'Howto & Style',
    '27': 'Education',
    '28': 'Science & Technology',
    '29': 'Nonprofits & Activism',
  };

  const category = categoryMap[categoryId] || 'Other';

  return {
    contentId,
    category,
    isPrimary: true,
    source: ContentCategorySource.PLATFORM,
  };
}

/**
 * YouTube 통계를 Content 통계로 변환
 */
export function mapYouTubeStatisticsToContentStatistics(video: YouTubeVideoDto): {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
} {
  const { viewCount, likeCount, commentCount } = video.statistics;
  const engagementRate = viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0;

  return {
    views: viewCount,
    likes: likeCount,
    comments: commentCount,
    shares: 0, // YouTube API는 공유 수를 제공하지 않음
    engagementRate: Math.min(engagementRate, 100), // 최대 100%
  };
}

/**
 * 썸네일 품질로 비디오 품질 추정
 */
function determineVideoQuality(thumbnails: YouTubeVideoDto['thumbnails']): ContentQuality {
  if (thumbnails.maxres) return ContentQuality._4K;
  if (thumbnails.standard || thumbnails.high) return ContentQuality.HD;
  return ContentQuality.SD;
}
