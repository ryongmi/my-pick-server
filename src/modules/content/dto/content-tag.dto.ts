import { Exclude, Expose } from 'class-transformer';

export class ContentTagDto {
  @Expose()
  tag!: string;

  @Expose()
  source!: 'platform' | 'ai' | 'manual';

  @Expose()
  relevanceScore!: number;

  @Expose()
  addedBy?: string;

  @Expose()
  usageCount!: number;

  @Expose()
  createdAt!: Date;
}
