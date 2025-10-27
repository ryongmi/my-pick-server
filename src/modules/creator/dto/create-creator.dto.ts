import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateCreatorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;
}
