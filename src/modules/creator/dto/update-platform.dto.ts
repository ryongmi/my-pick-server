import { IsOptional, IsUrl, IsNumber, IsBoolean, IsEnum, Min } from 'class-validator';
import { Expose } from 'class-transformer';
import { SyncStatus } from '../entities';

export class UpdatePlatformDto {
  @Expose()
  @IsOptional()
  @IsUrl({}, { message: '유효한 URL을 입력해주세요.' })
  url?: string;

  @Expose()
  @IsOptional()
  @IsNumber({}, { message: '팔로워 수는 숫자여야 합니다.' })
  @Min(0, { message: '팔로워 수는 0 이상이어야 합니다.' })
  followerCount?: number;

  @Expose()
  @IsOptional()
  @IsNumber({}, { message: '콘텐츠 수는 숫자여야 합니다.' })
  @Min(0, { message: '콘텐츠 수는 0 이상이어야 합니다.' })
  contentCount?: number;

  @Expose()
  @IsOptional()
  @IsNumber({}, { message: '총 조회수는 숫자여야 합니다.' })
  @Min(0, { message: '총 조회수는 0 이상이어야 합니다.' })
  totalViews?: number;

  @Expose()
  @IsOptional()
  @IsBoolean({ message: '활성 상태는 불린 값이어야 합니다.' })
  isActive?: boolean;

  @Expose()
  @IsOptional()
  @IsEnum(SyncStatus, { message: '유효한 동기화 상태를 선택해주세요.' })
  syncStatus?: SyncStatus;
}