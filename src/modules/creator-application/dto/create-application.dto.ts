import { ApiProperty } from '@nestjs/swagger';

import { IsString, IsNumber, IsArray, ValidateNested, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class ChannelInfoDto {
  @ApiProperty({
    description: '플랫폼 타입',
    example: 'youtube',
  })
  @IsString()
  platform!: string;

  @ApiProperty({
    description: '채널 ID',
    example: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @IsString()
  channelId!: string;

  @ApiProperty({
    description: '채널 URL',
    example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  })
  @IsString()
  channelUrl!: string;
}

class SampleVideoDto {
  @ApiProperty({
    description: '영상 제목',
    example: 'Minecraft: Building the Ultimate Castle',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: '영상 URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  url!: string;

  @ApiProperty({
    description: '조회수',
    example: 25000000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  views!: number;
}

export class CreateApplicationDto {
  @ApiProperty({
    description: '신청자 사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: '채널 정보',
    type: ChannelInfoDto,
  })
  @ValidateNested()
  @Type(() => ChannelInfoDto)
  channelInfo!: ChannelInfoDto;

  @ApiProperty({
    description: '구독자 수',
    example: 150000000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  subscriberCount!: number;

  @ApiProperty({
    description: '콘텐츠 카테고리',
    example: 'gaming',
  })
  @IsString()
  contentCategory!: string;

  @ApiProperty({
    description: '샘플 영상 목록',
    type: [SampleVideoDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleVideoDto)
  sampleVideos!: SampleVideoDto[];

  @ApiProperty({
    description: '채널 설명',
    example: 'Gaming content creator specializing in Minecraft and entertainment',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: '신청자 메시지',
    example: '안녕하세요, 크리에이터로 활동하고 싶습니다.',
    required: false,
  })
  @IsOptional()
  @IsString()
  applicantMessage?: string;

  @ApiProperty({
    description: '우선순위 (높을수록 우선 처리)',
    example: 1,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;
}
