import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SubscribeCreatorDto {
  @IsString()
  userId: string;

  @IsString()
  creatorId: string;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean = true;
}