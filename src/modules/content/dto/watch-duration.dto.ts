import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, IsPositive } from 'class-validator';

export class WatchDurationDto {
  @ApiProperty({
    description: '시청 시간 (초)',
    example: 120,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  watchDuration!: number;
}
