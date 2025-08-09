import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsOptional, IsArray, MaxLength, MinLength } from 'class-validator';

export class UpdateCreatorDto {
  @ApiPropertyOptional({
    description: '표시명',
    example: 'PewDiePie',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/avatar.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiPropertyOptional({
    description: '크리에이터 소개',
    example: 'Swedish YouTuber and gamer',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: '카테고리',
    example: 'gaming',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    description: '태그 목록',
    example: ['gaming', 'minecraft', 'comedy'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}
