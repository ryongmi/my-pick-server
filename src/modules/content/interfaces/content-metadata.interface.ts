export interface ContentMetadata {
  tags: string[];
  category: string;
  language: string;
  isLive: boolean;
  quality: 'sd' | 'hd' | '4k';
  ageRestriction?: boolean;
}