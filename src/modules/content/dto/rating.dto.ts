import { ApiProperty } from '@nestjs/swagger';

import { IsNumber, Min, Max } from 'class-validator';

export class RatingDto {
  @ApiProperty({
    description: '평점 (1-5)',
    example: 4.5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;
}
