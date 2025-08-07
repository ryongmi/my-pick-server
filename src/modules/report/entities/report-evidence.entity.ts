import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('report_evidence')
export class ReportEvidenceEntity {
  @PrimaryColumn({ comment: '외래키(reports.id)이자 기본키 - 1:1 관계 최적화' })
  reportId!: string;

  @Column({ 
    type: 'simple-array', 
    nullable: true,
    comment: '스크린샷 URL 목록'
  })
  screenshots?: string[];

  @Column({ 
    type: 'simple-array', 
    nullable: true,
    comment: '관련 URL 목록'
  })
  urls?: string[];

  @Column({ 
    type: 'json', 
    nullable: true,
    comment: '추가 증거 정보 (IP, User-Agent, 메타데이터 등)'
  })
  additionalInfo?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}