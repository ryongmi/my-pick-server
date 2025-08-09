import { Expose } from 'class-transformer';

export class RejectionReasonItemDto {
  @Expose()
  code!: string;

  @Expose()
  message!: string;
}
