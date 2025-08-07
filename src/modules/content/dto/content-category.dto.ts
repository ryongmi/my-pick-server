import { Exclude, Expose } from 'class-transformer';

export class ContentCategoryDto {
  @Expose()
  category!: string;

  @Expose()
  isPrimary!: boolean;

  @Expose()
  subcategory?: string;

  @Expose()
  confidence!: number;

  @Expose()
  source!: 'manual' | 'ai' | 'platform';

  @Expose()
  classifiedBy?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}