import { IsBoolean } from 'class-validator';

import { SwaggerApiProperty } from '@krgeobuk/swagger';

export class UpdateNotificationDto {
  @SwaggerApiProperty({
    description: '알림 활성화 여부',
    example: true,
  })
  @IsBoolean()
  notificationEnabled!: boolean;
}
