import { IsEnum } from 'class-validator';

import { ContentStatus } from '../enums/index.js';

/**
 * 콘텐츠 상태 변경 DTO
 * 크리에이터가 자신의 콘텐츠 공개/비공개를 변경할 때 사용
 */
export class UpdateContentStatusDto {
  @IsEnum(ContentStatus)
  status!: ContentStatus;
}
