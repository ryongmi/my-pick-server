import { IsEnum, IsArray, IsUUID, ArrayMinSize } from 'class-validator';

import { ContentStatus } from '../enums/index.js';

/**
 * 콘텐츠 일괄 상태 변경 DTO
 * 여러 콘텐츠의 상태를 동시에 변경할 때 사용
 */
export class BulkUpdateContentStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  contentIds!: string[];

  @IsEnum(ContentStatus)
  status!: ContentStatus;
}
