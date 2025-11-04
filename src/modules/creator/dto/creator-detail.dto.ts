import { Expose, Type } from 'class-transformer';

import { CreatorEntity } from '../entities/creator.entity.js';
import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';

/**
 * 크리에이터와 연결된 사용자 정보 DTO
 * auth-server로부터 TCP 통신으로 받아온 사용자 정보
 */
export class CreatorUserDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  name!: string;

  @Expose()
  profileImage?: string;
}

/**
 * 크리에이터 상세 정보 DTO
 * GET /creators/:id 응답 타입
 *
 * 크리에이터 기본 정보 + 연동 플랫폼 목록 + 사용자 정보를 포함
 */
export class CreatorDetailDto extends CreatorEntity {
  @Expose()
  @Type(() => CreatorPlatformEntity)
  platforms!: CreatorPlatformEntity[];

  @Expose()
  @Type(() => CreatorUserDto)
  user!: CreatorUserDto;
}
