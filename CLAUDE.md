# CLAUDE.md - MyPick Server

이 파일은 my-pick-server 작업 시 Claude Code의 가이드라인을 제공하며, **krgeobuk 생태계의 모든 NestJS 서버에서 공통으로 사용하는 표준 패턴**을 포함합니다.

## 서비스 개요

my-pick-server는 크리에이터/유튜버 팬들을 위한 통합 콘텐츠 허브 서비스의 백엔드 API 서버입니다. auth-server, authz-server와 연동하여 크리에이터 관리, 콘텐츠 통합, 추천 시스템 등을 제공합니다.

## 기술 스택

- **NestJS**: 백엔드 프레임워크
- **TypeScript**: ES 모듈 지원과 함께 완전한 TypeScript 구현
- **PostgreSQL**: 주 데이터베이스
- **Redis**: 캐싱 및 세션
- **Docker**: 컨테이너화

## 핵심 명령어

```bash
# 개발 서버 시작
npm run start:dev          # 일반 개발 서버
npm run start:debug        # 디버그 모드 (nodemon)

# 빌드
npm run build              # TypeScript 컴파일
npm run build:watch        # 감시 모드 빌드

# 코드 품질
npm run lint               # ESLint 실행
npm run lint-fix           # 자동 수정과 함께 린팅
npm run format             # Prettier 포맷팅

# 테스트
npm run test               # Jest 테스트 실행
npm run test:watch         # 감시 모드 테스트
npm run test:cov           # 커버리지 테스트
npm run test:e2e           # 엔드투엔드 테스트

# Docker 환경
npm run docker:local:up    # 로컬 Docker 스택 시작
npm run docker:local:down  # 로컬 Docker 스택 중지
npm run docker:dev:up      # 개발 Docker 환경
npm run docker:prod:up     # 프로덕션 Docker 환경
```

---

# MyPick Server 구현 계획

## 🎯 프로젝트 목표
my-pick-client의 mock API와 1:1 매칭되는 완전한 NestJS 백엔드 서버 구현

## 📋 현재 상황
- **프로젝트 기초 설정**: 완료
- **공통 인프라**: 완료 (DB, Redis, 환경설정)
- **TCP 클라이언트**: 이미 구현됨 (`src/common/clients`)
- **권한 검증**: `@krgeobuk/authorization` 패키지 활용
- **시작점**: 크리에이터 관리 도메인부터 구현

## 🏗 구현 단계별 계획

### Phase 1: 크리에이터 관리 시스템 (2-3일)

#### 1.1 Creator 도메인 - 단일 도메인 서비스 표준

**Entity 구조:**
```typescript
@Entity('creators')
export class CreatorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: 0 })
  followerCount: number;

  @Column({ default: 0 })
  contentCount: number;

  @Column({ type: 'bigint', default: 0 })
  totalViews: number;

  @Column()
  category: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @OneToMany(() => CreatorPlatformEntity, platform => platform.creator)
  platforms: CreatorPlatformEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('creator_platforms')
export class CreatorPlatformEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  creatorId: string;

  @Column({ type: 'enum', enum: ['youtube', 'twitter', 'instagram', 'tiktok'] })
  type: PlatformType;

  @Column()
  platformId: string; // 채널 ID, 사용자명 등

  @Column()
  url: string;

  @Column({ default: 0 })
  followerCount: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastSyncAt?: Date;

  @Column({ default: 'active' })
  syncStatus: 'active' | 'error' | 'disabled';

  @ManyToOne(() => CreatorEntity, creator => creator.platforms)
  creator: CreatorEntity;
}
```

**Service 구조 (krgeobuk 표준):**
```typescript
@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly userSubscriptionService: UserSubscriptionService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================
  
  // 기본 조회 메서드들
  async findById(creatorId: string): Promise<CreatorEntity | null> { }
  async findByIdOrFail(creatorId: string): Promise<CreatorEntity> { }
  async findByIds(creatorIds: string[]): Promise<CreatorEntity[]> { }
  async findByCategory(category: string): Promise<CreatorEntity[]> { }
  
  // 복합 조회 메서드들
  async searchCreators(query: CreatorSearchQueryDto): Promise<PaginatedResult<CreatorSearchResultDto>> { }
  async getCreatorById(creatorId: string): Promise<CreatorDetailDto> { }
  
  // ==================== 변경 메서드 ====================
  
  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<void> { }
  async updateCreator(creatorId: string, dto: UpdateCreatorDto, transactionManager?: EntityManager): Promise<void> { }
  async deleteCreator(creatorId: string): Promise<UpdateResult> { }
  
  // ==================== PRIVATE HELPER METHODS ====================
  
  private buildSearchResults(items: CreatorEntity[], pageInfo: any): PaginatedResult<CreatorSearchResultDto> { }
}
```

**주요 API 엔드포인트:**
```
GET    /api/v1/creators              # 크리에이터 목록 (검색, 필터링)
GET    /api/v1/creators/:id          # 크리에이터 상세
POST   /api/v1/creators/:id/subscribe # 구독
DELETE /api/v1/creators/:id/subscribe # 구독 해제
GET    /api/v1/creators/:id/stats    # 통계
```

#### 1.2 UserSubscription - 중간테이블 서비스 표준

**Entity 구조:**
```typescript
@Entity('user_subscriptions')
export class UserSubscriptionEntity {
  @PrimaryColumn()
  userId: string; // auth-server에서 관리하는 사용자 ID

  @PrimaryColumn()
  creatorId: string;

  @Column({ default: true })
  notificationEnabled: boolean;

  @CreateDateColumn()
  subscribedAt: Date;

  @ManyToOne(() => CreatorEntity)
  creator: CreatorEntity;
}
```

**Service 구조 (중간테이블 표준):**
```typescript
@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(private readonly userSubscriptionRepo: UserSubscriptionRepository) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================
  
  async getCreatorIds(userId: string): Promise<string[]> { }
  async getUserIds(creatorId: string): Promise<string[]> { }
  async exists(userId: string, creatorId: string): Promise<boolean> { }
  
  // ==================== 변경 메서드 ====================
  
  async subscribeToCreator(dto: { userId: string; creatorId: string }): Promise<void> { }
  async unsubscribeFromCreator(userId: string, creatorId: string): Promise<void> { }
  
  // ==================== 최적화 메서드 (필수) ====================
  
  async hasUsersForCreator(creatorId: string): Promise<boolean> { }
}
```

**중간테이블 API 패턴:**
```
GET    /users/:userId/subscriptions              # 사용자의 구독 목록
GET    /creators/:creatorId/subscribers          # 크리에이터의 구독자 목록
GET    /users/:userId/subscriptions/:creatorId/exists # 구독 관계 확인
POST   /users/:userId/subscriptions/:creatorId   # 구독
DELETE /users/:userId/subscriptions/:creatorId   # 구독 해제
```

#### 1.3 크리에이터 신청 시스템

**Entity 구조:**
```typescript
@Entity('creator_applications')
export class CreatorApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // 신청자 ID (auth-server 관리)

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'] })
  status: ApplicationStatus;

  @CreateDateColumn()
  appliedAt: Date;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  reviewerId?: string; // 검토자 ID (admin)

  @Column({ type: 'json' })
  applicationData: {
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
  };

  @Column({ type: 'json', nullable: true })
  reviewData?: {
    reason?: string;
    comment?: string;
    requirements?: string[];
  };
}
```

**주요 API:**
```
POST /api/v1/creator-application        # 크리에이터 신청
GET  /api/v1/creator-application/status # 신청 상태 조회
```

### Phase 2: 콘텐츠 관리 시스템 (3-4일)

#### 2.1 Content 도메인 - 단일 도메인 서비스

**Entity 구조:**
```typescript
@Entity('content')
export class ContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['youtube_video', 'twitter_post', 'instagram_post'] })
  type: ContentType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  thumbnail: string;

  @Column()
  url: string;

  @Column()
  platform: string;

  @Column()
  platformId: string; // 플랫폼별 고유 ID

  @Column({ nullable: true })
  duration?: number; // YouTube 영상 길이 (초)

  @Column()
  publishedAt: Date;

  @Column()
  creatorId: string;

  @OneToOne(() => ContentStatisticsEntity, stats => stats.content)
  statistics: ContentStatisticsEntity;

  @Column({ type: 'json' })
  metadata: {
    tags: string[];
    category: string;
    language: string;
    isLive: boolean;
    quality: 'sd' | 'hd' | '4k';
    ageRestriction?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('content_statistics')
export class ContentStatisticsEntity {
  @PrimaryColumn()
  contentId: string;

  @Column({ type: 'bigint', default: 0 })
  views: number;

  @Column({ default: 0 })
  likes: number;

  @Column({ default: 0 })
  comments: number;

  @Column({ default: 0 })
  shares: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementRate: number;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => ContentEntity, content => content.statistics)
  content: ContentEntity;
}
```

**주요 API:**
```
GET    /api/v1/content                 # 콘텐츠 피드 (페이지네이션, 필터링)
GET    /api/v1/content/:id             # 콘텐츠 상세
POST   /api/v1/content/:id/bookmark    # 북마크 추가
DELETE /api/v1/content/:id/bookmark    # 북마크 제거
POST   /api/v1/content/:id/like        # 좋아요
GET    /api/v1/content/bookmarks       # 북마크 목록
```

#### 2.2 UserInteraction - 중간테이블 서비스

**Entity 구조:**
```typescript
@Entity('user_interactions')
export class UserInteractionEntity {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  contentId: string;

  @Column({ default: false })
  isBookmarked: boolean;

  @Column({ default: false })
  isLiked: boolean;

  @Column({ nullable: true })
  watchedAt?: Date;

  @Column({ nullable: true })
  watchDuration?: number; // 시청 시간 (초)

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating?: number; // 1-5 평점
}
```

### Phase 3: 알림 시스템 (2-3일)

#### 3.1 Notification 도메인 + WebSocket

**Entity 구조:**
```typescript
@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ['new_video', 'live_stream', 'creator_update', 'system'] })
  type: NotificationType;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, any>; // 관련 데이터 (creatorId, contentId 등)

  @Column({ nullable: true })
  actionUrl?: string;

  @Column({ default: 'normal' })
  priority: 'low' | 'normal' | 'high';

  @Column({ nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('notification_settings')
export class NotificationSettingsEntity {
  @PrimaryColumn()
  userId: string;

  @Column({ default: true })
  newVideo: boolean;

  @Column({ default: true })
  liveStream: boolean;

  @Column({ default: false })
  weeklyDigest: boolean;

  @Column({ default: true })
  creatorUpdates: boolean;

  @Column({ default: false })
  communityPosts: boolean;

  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: true })
  pushNotifications: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**WebSocket Gateway:**
```typescript
@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: '*' }
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly notificationService: NotificationService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  @SubscribeMessage('join')
  async handleJoin(client: Socket, data: { token: string }) {
    // JWT 토큰 검증 (auth-server 통신)
    const user = await this.authClient.send('auth.validate', { token: data.token }).toPromise();
    
    if (user) {
      client.join(`user:${user.id}`);
      // 미읽은 알림 전송
      const unreadNotifications = await this.notificationService.getUnreadNotifications(user.id);
      client.emit('unread-notifications', unreadNotifications);
    }
  }

  async sendNotificationToUser(userId: string, notification: NotificationDto) {
    this.server.to(`user:${userId}`).emit('new-notification', notification);
  }
}
```

**주요 API:**
```
GET /api/v1/notifications              # 알림 목록
GET /api/v1/notifications/unread-count # 미읽음 수
PUT /api/v1/notifications/:id/read     # 읽음 처리
PUT /api/v1/notifications/read-all     # 전체 읽음
PUT /api/v1/notifications/settings     # 설정 수정
```

### Phase 4: 기본 추천 시스템 (2일)

#### 4.1 추천 엔진 구현

**구현 범위:**
- 구독 기반 추천 (구독한 크리에이터의 최신 콘텐츠)
- 카테고리 기반 추천 (사용자 선호 카테고리)
- 트렌딩 콘텐츠 (조회수, 좋아요 기반)
- 추천 피드백 수집

**주요 API:**
```
GET  /api/v1/recommendations/content   # 개인화 추천 콘텐츠
GET  /api/v1/recommendations/creators  # 추천 크리에이터
GET  /api/v1/recommendations/trending  # 트렌딩 콘텐츠
POST /api/v1/recommendations/feedback  # 추천 피드백
```

### Phase 5: 관리자 시스템 (2-3일)

#### 5.1 관리자 기능 구현

**주요 API:**
```
GET  /api/v1/admin/dashboard                    # 대시보드 통계
GET  /api/v1/admin/creator-applications         # 크리에이터 신청 목록
POST /api/v1/admin/creator-applications/:id/approve # 승인
POST /api/v1/admin/creator-applications/:id/reject  # 거부
```

**Controller 예시:**
```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard) // @krgeobuk/authorization 활용
export class AdminController {
  @Get('dashboard')
  @RequirePermission('admin.dashboard.read') // 권한 검증
  async getDashboardStats(): Promise<AdminDashboardDto> { }

  @Post('creator-applications/:id/approve')
  @RequirePermission('admin.creator-applications.approve')
  async approveApplication(
    @Param('id') applicationId: string,
    @Body() dto: ApprovalDto,
    @CurrentUser() admin: UserInfo
  ): Promise<void> { }
}
```

### Phase 6: 외부 API 통합 (기본) (2일)

#### 6.1 외부 API 서비스 구현

**구현 범위:**
- YouTube Data API v3 기본 연동 (채널 정보, 영상 목록)
- Twitter API v2 기본 연동 (사용자 정보, 트윗 목록)
- 기본적인 데이터 수집 로직
- API 레이트 리미팅 관리

```typescript
@Injectable()
export class YouTubeApiService {
  constructor(private readonly httpService: HttpService) {}

  async getChannelInfo(channelId: string): Promise<YouTubeChannelDto> {
    // YouTube API 호출 로직
  }

  async getChannelVideos(channelId: string, maxResults = 50): Promise<YouTubeVideoDto[]> {
    // YouTube API 호출 로직
  }
}

@Injectable()
export class TwitterApiService {
  async getUserInfo(username: string): Promise<TwitterUserDto> {
    // Twitter API 호출 로직
  }

  async getUserTweets(userId: string, maxResults = 100): Promise<TwitterTweetDto[]> {
    // Twitter API 호출 로직
  }
}
```

### Phase 7: 성능 최적화 및 마무리 (1-2일)

#### 7.1 최적화 작업
- 데이터베이스 인덱스 최적화
- Redis 캐싱 전략 구현
- API 응답 시간 최적화
- Swagger 문서 완성

## 🔄 krgeobuk 표준 패턴 활용

### @krgeobuk/authorization 패키지 사용

```typescript
import { AuthGuard, RequirePermission, CurrentUser } from '@krgeobuk/authorization';

@Controller('creators')
export class CreatorController {
  @Post(':id/subscribe')
  @UseGuards(AuthGuard) // 로그인 필수
  async subscribeToCreator(
    @Param('id') creatorId: string,
    @CurrentUser() user: UserInfo // 사용자 정보 자동 주입
  ): Promise<void> {
    // 구독 로직
  }
}

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  @Get('dashboard')
  @RequirePermission('admin.dashboard.read') // 특정 권한 필요
  async getDashboardStats(): Promise<AdminDashboardDto> {
    // 관리자 대시보드 로직
  }
}
```

### TCP 클라이언트 활용

```typescript
// 기존 TCP 클라이언트 설정 활용
constructor(
  @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  @Inject('AUTHZ_SERVICE') private readonly authzClient: ClientProxy
) {}

// 사용자 정보 조회
async getUserInfo(userId: string): Promise<UserInfo> {
  return this.authClient.send('user.findById', { userId }).toPromise();
}

// 권한 검증
async checkPermission(userId: string, permission: string): Promise<boolean> {
  return this.authzClient.send('permission.check', { userId, permission }).toPromise();
}
```

### TCP 컨트롤러 표준 구현

```typescript
@Controller()
export class CreatorTcpController {
  private readonly logger = new Logger(CreatorTcpController.name);

  constructor(private readonly creatorService: CreatorService) {}

  @MessagePattern('creator.findById')
  async findById(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator detail request: ${data.creatorId}`);
    return await this.creatorService.findById(data.creatorId);
  }

  @MessagePattern('creator.search')
  async search(@Payload() query: CreatorSearchQueryDto) {
    this.logger.debug('TCP creator search request', {
      hasNameFilter: !!query.name,
      category: query.category,
    });
    return await this.creatorService.searchCreators(query);
  }
}
```

### 예외 처리 표준화

```typescript
// CreatorException 클래스
export class CreatorException {
  // 조회 관련 (100-199)
  static creatorNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_101',
      message: '크리에이터를 찾을 수 없습니다.',
    });
  }

  static creatorFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_102',
      message: '크리에이터 조회 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static creatorAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_201',
      message: '이미 존재하는 크리에이터입니다.',
    });
  }

  static creatorCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_202',
      message: '크리에이터 생성 중 오류가 발생했습니다.',
    });
  }
}
```

## ⚡ krgeobuk 표준 준수 체크리스트

### 서비스 클래스 구조
- [x] PUBLIC METHODS와 PRIVATE HELPER METHODS 섹션 분리
- [x] 메서드 순서: 조회(findBy*) → 검색(search*) → 변경(create/update/delete) → Private 헬퍼
- [x] 표준 메서드 네이밍 적용 (findById, findByIdOrFail, search*, create*, update*, delete*)

### 에러 처리 표준
- [x] 도메인별 Exception 클래스 사용
- [x] HttpException 인스턴스 체크 후 재전파
- [x] 구조화된 에러 로깅 (error, context 포함)
- [x] 범주별 에러 코드 체계 (100-199: 조회, 200-299: 변경)

### 로깅 시스템
- [x] 적절한 로그 레벨 사용 (ERROR/WARN/LOG/DEBUG)
- [x] 구조화된 로그 메시지 형식
- [x] 메타데이터 객체 포함 (entityId, operation 등)

### API 설계 표준
- [x] 단일 도메인: `/creators` (목록/생성/상세/수정/삭제)
- [x] 중간테이블: `/users/:userId/subscriptions/:creatorId` (관계 생성/삭제/확인)
- [x] @Serialize() 데코레이터로 응답 DTO 지정
- [x] @RequirePermission() 데코레이터로 권한 검증

### TCP 컨트롤러 표준
- [x] 표준 메시지 패턴 네이밍 (`domain.operation`)
- [x] 적절한 로그 레벨 (조회: DEBUG, 변경: LOG)
- [x] 중간테이블 양방향 조회 지원

## 🏗 도메인 모듈 구조

my-pick-server는 다음과 같은 도메인 모듈들로 구성됩니다:

### 핵심 도메인 (단일 도메인 패턴)
- **creator** - 크리에이터 관리 (기본 CRUD 패턴)
- **content** - 콘텐츠 관리 (기본 CRUD 패턴)
- **notification** - 알림 관리 (기본 CRUD 패턴)
- **creator-application** - 크리에이터 신청 관리

### 중간테이블 도메인 (중간테이블 패턴)
- **user-subscription** - 사용자-크리에이터 구독 관계
- **user-interaction** - 사용자-콘텐츠 상호작용 (북마크, 좋아요)

### 지원 도메인
- **recommendation** - 추천 시스템
- **external-api** - 외부 API 통합 (YouTube, Twitter)
- **admin** - 관리자 기능

## 🌐 환경 설정

- **포트**: 4000
- **PostgreSQL**: 포트 5432
- **Redis**: 포트 6379
- **환경 파일**: `.env` 파일들

## 🔗 마이크로서비스 연동

### 연동하는 서비스
- **auth-server**: 사용자 인증 및 정보 조회
- **authz-server**: 권한 검증

### TCP 클라이언트 위치
- `src/common/clients/` 디렉토리에 TCP 클라이언트 설정 완료

## 📅 총 소요 기간

**약 1.5-2주 (10-14일)**

각 Phase는 krgeobuk 생태계의 표준 패턴을 완벽히 준수하여 구현되며, 기존 서비스들과 일관된 코드 품질과 구조를 유지합니다.

---

# krgeobuk NestJS 서버 공통 개발 표준

이 섹션은 krgeobuk 생태계의 **모든 NestJS 서버**(auth-server, authz-server, my-pick-server)에서 공통으로 적용되는 표준입니다.

## 서비스 아키텍처 패턴

### 1. 단일 도메인 서비스 (Single Domain Service)

단일 도메인 서비스는 하나의 엔티티를 중심으로 하는 서비스로, 해당 도메인의 비즈니스 로직과 데이터 접근을 담당합니다.

**적용 예시**: `CreatorService`, `ContentService`, `NotificationService`

#### 1.1 기본 구조

```typescript
@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly userSubscriptionService: UserSubscriptionService, // 의존 서비스
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy // 외부 서비스
  ) {}

  // ==================== PUBLIC METHODS ====================
  
  // 기본 조회 메서드들
  async findById(creatorId: string): Promise<Entity | null> { }
  async findByIdOrFail(creatorId: string): Promise<Entity> { }
  async findByIds(creatorIds: string[]): Promise<Entity[]> { }
  async findByCategory(category: string): Promise<Entity[]> { }
  
  // 복합 조회 메서드들
  async searchCreators(query: SearchQueryDto): Promise<PaginatedResult<SearchResult>> { }
  async getCreatorById(creatorId: string): Promise<DetailResult> { }
  
  // ==================== 변경 메서드 ====================
  
  async createCreator(dto: CreateDto, transactionManager?: EntityManager): Promise<void> { }
  async updateCreator(creatorId: string, dto: UpdateDto, transactionManager?: EntityManager): Promise<void> { }
  async deleteCreator(creatorId: string): Promise<UpdateResult> { }
  
  // ==================== PRIVATE HELPER METHODS ====================
  
  private async getExternalData(): Promise<ExternalData> { }
  private buildSearchResults(items: Entity[], metadata: any): SearchResult[] { }
}
```

### 2. 중간 테이블 서비스 (Junction Table Service)

중간 테이블 서비스는 두 도메인 간의 관계를 관리하는 서비스입니다.

**적용 예시**: `UserSubscriptionService`, `UserInteractionService`

#### 2.1 기본 구조

```typescript
@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(private readonly userSubscriptionRepo: UserSubscriptionRepository) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================
  
  async getCreatorIds(userId: string): Promise<string[]> { }
  async getUserIds(creatorId: string): Promise<string[]> { }
  async exists(userId: string, creatorId: string): Promise<boolean> { }
  
  // 배치 조회 메서드
  async getCreatorIdsBatch(userIds: string[]): Promise<Record<string, string[]>> { }
  
  // ==================== 변경 메서드 ====================
  
  async subscribeToCreator(dto: {userId: string; creatorId: string}): Promise<void> { }
  async unsubscribeFromCreator(userId: string, creatorId: string): Promise<void> { }
  
  // ==================== 최적화 메서드 (필수) ====================
  
  async hasUsersForCreator(creatorId: string): Promise<boolean> { }
}
```

## API 설계 표준

### 단일 도메인 API 패턴
```typescript
GET    /{domain}s                    # 목록 조회 (검색)
POST   /{domain}s                    # 생성
GET    /{domain}s/:id                # 상세 조회
PATCH  /{domain}s/:id                # 수정
DELETE /{domain}s/:id                # 삭제
```

### 중간테이블 API 패턴
```typescript
GET    /{entityA}s/:idA/{entityB}s           # A의 B 목록
GET    /{entityB}s/:idB/{entityA}s           # B의 A 목록
GET    /{entityA}s/:idA/{entityB}s/:idB/exists # 관계 존재 확인
POST   /{entityA}s/:idA/{entityB}s/:idB      # 관계 생성
DELETE /{entityA}s/:idA/{entityB}s/:idB      # 관계 삭제
```

## 에러 처리 표준

### 에러 검증 및 메시지 패턴
```typescript
async createEntity(attrs: CreateAttrs): Promise<void> {
  try {
    // 1. 사전 검증 (비즈니스 규칙)
    if (attrs.name && attrs.category) {
      const existing = await this.repo.findOne({
        where: { name: attrs.name, category: attrs.category }
      });
      
      if (existing) {
        this.logger.warn('Entity creation failed: duplicate name', {
          name: attrs.name,
          category: attrs.category,
        });
        throw EntityException.entityAlreadyExists();
      }
    }

    // 2. 엔티티 생성 및 저장
    const entity = new EntityClass();
    Object.assign(entity, attrs);
    await this.repo.save(entity);
    
    // 3. 성공 로깅
    this.logger.log('Entity created successfully', {
      entityId: entity.id,
      name: attrs.name,
      category: attrs.category,
    });
  } catch (error: unknown) {
    // 4. 에러 처리 및 로깅
    if (error instanceof HttpException) {
      throw error; // 이미 처리된 예외는 그대로 전파
    }

    this.logger.error('Entity creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name: attrs.name,
      category: attrs.category,
    });
    
    throw EntityException.entityCreateError();
  }
}
```

### 도메인별 Exception 클래스
```typescript
export class CreatorException {
  // 조회 관련 (100-199)
  static creatorNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_101',
      message: '크리에이터를 찾을 수 없습니다.',
    });
  }

  // 생성/수정 관련 (200-299)  
  static creatorAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_201',
      message: '이미 존재하는 크리에이터입니다.',
    });
  }
}
```

## 로깅 표준

### 로그 레벨 사용 기준
```typescript
// ERROR: 시스템 오류, 예외 상황
this.logger.error('Entity creation failed', {
  error: error instanceof Error ? error.message : 'Unknown error',
  entityId: id,
});

// WARN: 비정상적이지만 처리 가능한 상황
this.logger.warn('External service unavailable, using fallback', {
  service: 'auth-service',
  entityId: id,
});

// LOG/INFO: 중요한 비즈니스 이벤트
this.logger.log('Entity created successfully', {
  entityId: result.id,
  entityType: 'Creator',
});

// DEBUG: 개발용, 고빈도 호출 API
this.logger.debug('TCP request received', {
  operation: 'findById',
  entityId: id,
});
```

## TCP 컨트롤러 표준

### 메시지 패턴 네이밍 규칙
```typescript
@Controller()
export class EntityTcpController {
  private readonly logger = new Logger(EntityTcpController.name);

  constructor(private readonly entityService: EntityService) {}

  // 조회 패턴
  @MessagePattern('entity.findById')
  async findById(@Payload() data: { entityId: string }) {
    this.logger.debug(`TCP entity detail request: ${data.entityId}`);
    return await this.entityService.findById(data.entityId);
  }

  @MessagePattern('entity.search')
  async search(@Payload() query: EntitySearchQuery) {
    this.logger.debug('TCP entity search request');
    return await this.entityService.searchEntities(query);
  }

  // 변경 패턴
  @MessagePattern('entity.create')
  async create(@Payload() data: CreateEntity) {
    this.logger.log('TCP entity creation requested');
    return await this.entityService.createEntity(data);
  }
}
```

## 개발 참고사항

### 경로 별칭
TypeScript 경로 별칭:
- `@modules/*` → `src/modules/*`
- `@common/*` → `src/common/*`
- `@config/*` → `src/config/*`
- `@database/*` → `src/database/*`

### 코딩 표준
- **any 타입 완전 금지**: 모든 변수와 매개변수에 명시적 타입 지정
- **함수 반환값 타입 필수**: 모든 함수에 명시적 반환 타입 지정
- **catch 블록 타입**: `catch (error: unknown)` 패턴 사용
- **console 사용 금지**: Logger 클래스만 사용

이러한 표준을 준수하면 krgeobuk 생태계의 모든 NestJS 서비스에서 일관된 코드 품질과 유지보수성을 보장할 수 있습니다.