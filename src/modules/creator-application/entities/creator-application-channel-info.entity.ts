import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('creator_application_channel_info')
export class CreatorApplicationChannelInfoEntity {
  @PrimaryColumn('uuid', { comment: '신청서 ID (1:1 관계)' })
  applicationId!: string;

  @Column({ comment: '플랫폼 타입 (youtube, twitter, instagram 등)' })
  platform!: string;

  @Column({ comment: '채널/계정 ID' })
  channelId!: string;

  @Column({ comment: '채널/계정 URL' })
  channelUrl!: string;

  @Column('int', { comment: '구독자/팔로워 수' })
  subscriberCount!: number;

  @Column({ comment: '콘텐츠 카테고리' })
  contentCategory!: string;

  @Column('text', { comment: '크리에이터 소개' })
  description!: string;
}
