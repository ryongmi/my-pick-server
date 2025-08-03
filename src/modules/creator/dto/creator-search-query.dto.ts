import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsArray, IsInt, Min, Max, IsEnum } from 'class-validator';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';

export class CreatorSearchQueryDto {
  @ApiPropertyOptional({
    description: '크리에이터 이름 또는 표시명으로 검색',
    example: 'PewDiePie',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '카테고리로 필터링',
    example: 'gaming',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: '인증된 크리에이터만 조회',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: '태그로 필터링 (여러 개 가능)',
    example: ['gaming', 'minecraft'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(tag => tag.trim());
    }
    return value;
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 결과 수',
    example: LimitType.THIRTY,
    enum: LimitType,
    enumName: 'LimitType',
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(LimitType)
  limit?: LimitType = LimitType.THIRTY;

  @ApiPropertyOptional({
    description: '정렬 순서',
    example: SortOrderType.DESC,
    enum: SortOrderType,
    enumName: 'SortOrderType',
  })
  @IsOptional()
  @IsEnum(SortOrderType)
  sortOrder?: SortOrderType = SortOrderType.DESC;

  @ApiPropertyOptional({
    description: '정렬 기준',
    example: 'createdAt',
    enum: ['name', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'createdAt' = 'createdAt';
}