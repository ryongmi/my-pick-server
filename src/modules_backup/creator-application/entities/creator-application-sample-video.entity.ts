import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity('creator_application_sample_videos')
@Index(['applicationId']) // 신청서별 샘플 영상 조회 최적화
@Index(['applicationId', 'sortOrder']) // 정렬 순서 기준 조회 최적화
export class CreatorApplicationSampleVideoEntity extends BaseEntityUUID {
  @Column('uuid', { comment: '신청서 ID (1:N 관계 FK)' })
  applicationId!: string;

  @Column({ comment: '영상 제목' })
  title!: string;

  @Column({ comment: '영상 URL' })
  url!: string;

  @Column('int', { comment: '조회수' })
  views!: number;

  @Column('tinyint', { comment: '정렬 순서 (1부터 시작)' })
  sortOrder!: number;
}
