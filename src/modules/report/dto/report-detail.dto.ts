import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Expose, Type } from 'class-transformer';

import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';
import { ReportActionType } from '../entities/index.js';

export class ReportReporterInfoDto {
  @ApiProperty({
    description: '신고자 이메일',
    example: 'reporter@example.com',
  })
  @Expose()
  email!: string;

  @ApiPropertyOptional({
    description: '신고자 이름',
    example: '신고자',
  })
  @Expose()
  name?: string;
}

export class ReportTargetInfoDto {
  @ApiPropertyOptional({
    description: '대상 제목 (콘텐츠의 경우)',
    example: '부적절한 콘텐츠 제목',
  })
  @Expose()
  title?: string;

  @ApiPropertyOptional({
    description: '대상 이름 (사용자/크리에이터의 경우)',
    example: '사용자 이름',
  })
  @Expose()
  name?: string;

  @ApiPropertyOptional({
    description: '대상 타입',
    example: 'content',
  })
  @Expose()
  type?: string;
}

export class ReportEvidenceDetailDto {
  @ApiPropertyOptional({
    description: '스크린샷 URL 목록',
    type: [String],
  })
  @Expose()
  screenshots?: string[];

  @ApiPropertyOptional({
    description: '관련 URL 목록',
    type: [String],
  })
  @Expose()
  urls?: string[];

  @ApiPropertyOptional({
    description: '추가 증거 정보',
    type: 'object',
  })
  @Expose()
  additionalInfo?: Record<string, unknown>;
}

export class ReportActionDetailDto {
  @ApiProperty({
    description: '조치 타입',
    enum: ReportActionType,
  })
  @Expose()
  actionType!: ReportActionType;

  @ApiPropertyOptional({
    description: '정지 기간 (일 단위)',
  })
  @Expose()
  duration?: number;

  @ApiPropertyOptional({
    description: '조치 사유',
  })
  @Expose()
  reason?: string;
}

export class ReportDetailDto {
  @ApiProperty({
    description: '신고 ID',
    example: 'report-uuid-here',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: '신고자 ID',
    example: 'user-uuid-here',
  })
  @Expose()
  reporterId!: string;

  @ApiProperty({
    description: '신고 대상 타입',
    enum: ReportTargetType,
  })
  @Expose()
  targetType!: ReportTargetType;

  @ApiProperty({
    description: '신고 대상 ID',
    example: 'target-uuid-here',
  })
  @Expose()
  targetId!: string;

  @ApiProperty({
    description: '신고 사유',
    enum: ReportReason,
  })
  @Expose()
  reason!: ReportReason;

  @ApiPropertyOptional({
    description: '신고 상세 설명',
  })
  @Expose()
  description?: string;

  @ApiPropertyOptional({
    description: '신고 증거 자료',
    type: ReportEvidenceDetailDto,
  })
  @Expose()
  @Type(() => ReportEvidenceDetailDto)
  evidence?: ReportEvidenceDetailDto;

  @ApiProperty({
    description: '신고 상태',
    enum: ReportStatus,
  })
  @Expose()
  status!: ReportStatus;

  @ApiPropertyOptional({
    description: '검토자 ID',
  })
  @Expose()
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '검토 완료 시간',
  })
  @Expose()
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: '검토 의견',
  })
  @Expose()
  reviewComment?: string;

  @ApiPropertyOptional({
    description: '신고 조치 정보',
    type: ReportActionDetailDto,
  })
  @Expose()
  @Type(() => ReportActionDetailDto)
  actions?: ReportActionDetailDto;

  @ApiProperty({
    description: '우선순위 (1: 높음, 2: 보통, 3: 낮음)',
    minimum: 1,
    maximum: 3,
  })
  @Expose()
  priority!: number;

  @ApiProperty({
    description: '신고 생성 시간',
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: '신고 수정 시간',
  })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: '신고자 정보',
    type: ReportReporterInfoDto,
  })
  @Expose()
  @Type(() => ReportReporterInfoDto)
  reporterInfo?: ReportReporterInfoDto;

  @ApiPropertyOptional({
    description: '신고 대상 정보',
    type: ReportTargetInfoDto,
  })
  @Expose()
  @Type(() => ReportTargetInfoDto)
  targetInfo?: ReportTargetInfoDto;
}
