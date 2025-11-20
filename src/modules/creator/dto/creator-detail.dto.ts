import { Expose, Type } from 'class-transformer';

import { SwaggerApiProperty } from '@krgeobuk/swagger';

import { CreatorEntity } from '../entities/creator.entity.js';
import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';

/**
 * 크리에이터와 연결된 사용자 정보 DTO
 * auth-server로부터 TCP 통신으로 받아온 사용자 정보
 */
export class CreatorUserDto {
  @SwaggerApiProperty({
    description: '사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  id!: string;

  @SwaggerApiProperty({
    description: '사용자 이메일',
    example: 'creator@example.com',
  })
  @Expose()
  email!: string;

  @SwaggerApiProperty({
    description: '사용자 이름',
    example: 'Ado',
  })
  @Expose()
  name!: string;

  @SwaggerApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
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
  @SwaggerApiProperty({
    description: '크리에이터가 연동한 플랫폼 목록',
    type: [CreatorPlatformEntity],
    example: [],
  })
  @Expose()
  @Type(() => CreatorPlatformEntity)
  platforms!: CreatorPlatformEntity[];

  @SwaggerApiProperty({
    description: '크리에이터 사용자 정보',
    type: CreatorUserDto,
    example: {},
  })
  @Expose()
  @Type(() => CreatorUserDto)
  user!: CreatorUserDto;
}
