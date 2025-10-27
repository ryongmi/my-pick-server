import { ApplicationStatus, ChannelInfo, ReviewInfo } from '../entities/creator-application.entity.js';

export class ApplicationDetailDto {
  id!: string;
  userId!: string;
  channelInfo!: ChannelInfo;
  status!: ApplicationStatus;
  appliedAt!: Date;
  applicantMessage?: string;
  reviewInfo?: ReviewInfo;
  createdCreatorId?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
