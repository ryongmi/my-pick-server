import { Exclude, Expose, Type } from 'class-transformer';

class CreatorPlatformDto {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  platformId!: string;

  @Expose()
  url!: string;

  @Expose()
  followerCount!: number;

  @Expose()
  contentCount!: number;

  @Expose()
  totalViews!: number;

  @Expose()
  isActive!: boolean;
}

export class CreatorSearchResultDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  displayName!: string;

  @Expose()
  avatar?: string | undefined;

  @Expose()
  description?: string | undefined;

  @Expose()
  isVerified!: boolean;

  @Expose()
  followerCount!: number;

  @Expose()
  subscriberCount!: number;

  @Expose()
  contentCount!: number;

  @Expose()
  totalViews!: number;

  @Expose()
  category!: string;

  @Expose()
  tags?: string[] | undefined;

  @Expose()
  @Type(() => CreatorPlatformDto)
  platforms!: CreatorPlatformDto[];

  @Expose()
  createdAt!: Date;
}

export class PaginatedResult<T> {
  @Expose()
  items!: T[];

  @Expose()
  total!: number;

  @Expose()
  page!: number;

  @Expose()
  limit!: number;

  @Expose()
  totalPages!: number;

  @Expose()
  hasNext!: boolean;

  @Expose()
  hasPrev!: boolean;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}