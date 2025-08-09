import { registerAs } from '@nestjs/config';

export const youtubeConfig = registerAs('youtube', () => ({
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
}));
