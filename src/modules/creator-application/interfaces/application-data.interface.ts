export interface ApplicationData {
  channelInfo: {
    platform: string;
    channelId: string;
    channelUrl: string;
  };
  subscriberCount: number;
  contentCategory: string;
  sampleVideos: Array<{
    title: string;
    url: string;
    views: number;
  }>;
  description: string;
}