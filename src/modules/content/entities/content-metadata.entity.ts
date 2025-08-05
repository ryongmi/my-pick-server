import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_metadata')
@Index(['category']) // 카테고리별 조회 최적화
@Index(['language']) // 언어별 조회 최적화
@Index(['quality']) // 화질별 조회 최적화
@Index(['isLive']) // 라이브 콘텐츠 조회 최적화
@Index(['ageRestriction']) // 연령 제한 조회 최적화
@Index(['category', 'language']) // 카테고리+언어 조합 조회 최적화
export class ContentMetadataEntity {
  @PrimaryColumn({ comment: '외래키(content.id)이자 기본키 - 1:1 관계 최적화' })
  contentId!: string;

  @Column({ 
    type: 'simple-array',
    comment: '콘텐츠 태그 목록'
  })
  tags!: string[];

  @Column({
    comment: '콘텐츠 카테고리'
  })
  category!: string;

  @Column({
    comment: '콘텐츠 언어'
  })
  language!: string;

  @Column({ 
    default: false,
    comment: '라이브 스트리밍 여부'
  })
  isLive!: boolean;

  @Column({ 
    type: 'enum', 
    enum: ['sd', 'hd', '4k'], 
    default: 'hd',
    comment: '콘텐츠 화질'
  })
  quality!: 'sd' | 'hd' | '4k';

  @Column({ 
    default: false,
    comment: '연령 제한 여부'
  })
  ageRestriction!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}