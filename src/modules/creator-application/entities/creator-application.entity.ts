import { Entity, Column, CreateDateColumn } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

import { ApplicationStatus } from '../enums/index.js';
import { ApplicationData, ReviewData } from '../interfaces/index.js';

@Entity('creator_applications')
export class CreatorApplicationEntity extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: ApplicationStatus })
  status!: ApplicationStatus;

  @CreateDateColumn()
  appliedAt!: Date;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  reviewerId?: string;

  @Column({ type: 'json' })
  applicationData!: ApplicationData;

  @Column({ type: 'json', nullable: true })
  reviewData?: ReviewData;
}

