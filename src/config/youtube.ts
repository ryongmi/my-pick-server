import { registerAs } from '@nestjs/config';

import { YouTubeConfig } from '@/common/interfaces/config.interfaces.js';

export const youtubeConfig = registerAs(
  'youtube',
  (): YouTubeConfig => ({
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
  })
);
