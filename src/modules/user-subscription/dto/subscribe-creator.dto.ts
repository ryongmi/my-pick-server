import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class SubscribeCreatorDto {
  @IsUUID()
  creatorId!: string;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;
}
