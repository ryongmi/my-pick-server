import { PartialType } from '@nestjs/mapped-types';

import { CreatePlatformApplicationDto } from './create-platform-application.dto.js';

export class UpdatePlatformApplicationDto extends PartialType(CreatePlatformApplicationDto) {
  // creatorId는 수정할 수 없으므로 제외
  // 나머지 필드들은 모두 선택적으로 수정 가능
}