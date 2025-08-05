import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { PlatformType, VerificationProofType } from '../enums/index.js';

@Entity('platform_application_data')
export class PlatformApplicationDataEntity {
  @PrimaryColumn('uuid', { comment: '신청 ID (1:1 관계 부모 PK 사용)' })
  applicationId!: string; // PlatformApplicationEntity의 ID와 동일

  @Column({ type: 'enum', enum: PlatformType })
  type!: PlatformType;

  @Column()
  platformId!: string; // 채널 ID, 사용자명 등

  @Column()
  url!: string; // 플랫폼 URL

  @Column()
  displayName!: string; // 표시명

  @Column({ type: 'text', nullable: true })
  description?: string; // 설명

  @Column({ nullable: true })
  followerCount?: number; // 현재 팔로워 수

  @Column({ type: 'enum', enum: VerificationProofType })
  verificationProofType!: VerificationProofType;

  @Column()
  verificationProofUrl!: string; // 인증 자료 URL

  @Column({ type: 'text' })
  verificationProofDescription!: string; // 인증 설명

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}