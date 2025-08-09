import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, Min } from 'class-validator';

export class UpdatePriorityDto {
  @ApiProperty({
    description: '우선순위 (숫자가 낮을수록 높은 우선순위)',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  priority!: number;
}
