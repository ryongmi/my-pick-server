import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface ApplicationData {
  channelInfo: {
    platform: string;
    channelId: string;
    channelUrl: string;
  };
  subscriberCount: number;
  contentCategory: string;
  sampleVideos: Array<{
    title: string;
    url: string;
    views: number;
  }>;
  description: string;
}

export interface ReviewData {
  reason?: string;
  comment?: string;
  requirements?: string[];
}

@Entity('creator_applications')
export class CreatorApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ApplicationStatus })
  status: ApplicationStatus;

  @CreateDateColumn()
  appliedAt: Date;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  reviewerId?: string;

  @Column({ type: 'json' })
  applicationData: ApplicationData;

  @Column({ type: 'json', nullable: true })
  reviewData?: ReviewData;
}