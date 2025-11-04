import { RegistrationStatus, ChannelInfo, ReviewInfo } from '../entities/creator-registration.entity.js';

export class RegistrationDetailDto {
  id!: string;
  userId!: string;
  channelInfo!: ChannelInfo;
  status!: RegistrationStatus;
  appliedAt!: Date;
  registrationMessage?: string;
  reviewInfo?: ReviewInfo;
  createdCreatorId?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
