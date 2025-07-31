import { IsString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ChannelInfoDto {
  @IsString()
  platform!: string;

  @IsString()
  channelId!: string;

  @IsString()
  channelUrl!: string;
}

class SampleVideoDto {
  @IsString()
  title!: string;

  @IsString()
  url!: string;

  @IsNumber()
  @Min(0)
  views!: number;
}

export class CreateApplicationDto {
  @IsString()
  userId!: string;

  @ValidateNested()
  @Type(() => ChannelInfoDto)
  channelInfo!: ChannelInfoDto;

  @IsNumber()
  @Min(0)
  subscriberCount!: number;

  @IsString()
  contentCategory!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleVideoDto)
  sampleVideos!: SampleVideoDto[];

  @IsString()
  description!: string;
}