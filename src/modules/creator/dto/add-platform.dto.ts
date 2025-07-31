import { IsEnum, IsString, IsUrl, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { Expose } from 'class-transformer';

import { PlatformType } from '@common/enums/index.js';

export class AddPlatformDto {
  @Expose()
  @IsEnum(PlatformType, { message: '유효한 플랫폼 타입을 선택해주세요.' })
  type!: PlatformType;

  @Expose()
  @IsString({ message: '플랫폼 ID는 문자열이어야 합니다.' })
  platformId!: string;

  @Expose()
  @IsUrl({}, { message: '유효한 URL을 입력해주세요.' })
  url!: string;

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
}