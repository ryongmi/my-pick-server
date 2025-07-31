import { Entity, Column } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ApiProvider, ApiOperation } from '../enums/index.js';

@Entity('api_quota_usage')
export class ApiQuotaUsageEntity extends BaseEntityUUID {
  @Column({ type: 'enum', enum: ApiProvider })
  apiProvider!: ApiProvider;

  @Column({ type: 'enum', enum: ApiOperation })
  operation!: ApiOperation;

  @Column({ default: 1 })
  quotaUnits!: number; // 소모된 쿼터 단위

  @Column({ type: 'text', nullable: true })
  requestDetails?: string; // 요청 세부사항 (JSON)

  @Column({ nullable: true })
  responseStatus?: string; // 응답 상태

  @Column({ type: 'text', nullable: true })
  errorMessage?: string; // 에러 메시지

  // usedAt, date 필드 제거 - BaseEntityUUID의 createdAt 사용
  // usedAt → createdAt 대체
  // date → createdAt에서 날짜 부분 추출하여 집계에 사용
}

