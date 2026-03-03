# MyPick Server - 프로젝트 정보

## 📖 프로젝트 개요

MyPick Server는 크리에이터/유튜버 팬들을 위한 통합 콘텐츠 허브 서비스의 **백엔드 API 서버**입니다.

### 🎯 핵심 역할
- **외부 API 통합**: YouTube Data API, Twitter API 등 크리에이터 플랫폼 연동
- **데이터 처리**: 실시간 콘텐츠 수집, 정제, 저장 및 서비스
- **개인화 엔진**: AI/ML 기반 맞춤형 추천 시스템
- **실시간 서비스**: WebSocket 기반 즉시 알림 및 업데이트
- **커뮤니티 백엔드**: 팬 커뮤니티 및 소셜 기능 지원

### 🔧 주요 서비스 도메인
- **크리에이터 관리**: 크리에이터 정보 및 구독 관리
- **콘텐츠 수집**: 다중 플랫폼 콘텐츠 자동 수집
- **사용자 서비스**: 인증, 프로필, 개인화 설정
- **추천 시스템**: ML 기반 콘텐츠 및 크리에이터 추천
- **알림 시스템**: 실시간 알림 및 커뮤니케이션
- **분석 서비스**: 사용자 행동 분석 및 인사이트

## 🛠 기술 스택 & 아키텍처

### 백엔드 프레임워크
```yaml
핵심 기술:
  - NestJS 10+: 확장 가능한 Node.js 서버 프레임워크
  - TypeScript: 완전한 타입 안전성
  - Express: 빠르고 간결한 웹 프레임워크

모듈 시스템:
  - 모듈 기반 아키텍처: 기능별 모듈 분리
  - 의존성 주입: 테스트 가능하고 유지보수 용이한 구조
  - 데코레이터 패턴: 선언적 프로그래밍
```

### 데이터베이스 & 스토리지
```yaml
주 데이터베이스:
  - MySQL: 관계형 데이터 저장소
  - TypeORM/Prisma: ORM (Object-Relational Mapping)
  - 마이그레이션: 스키마 버전 관리

캐싱 레이어:
  - Redis 7: 세션, 캐싱, 메시지 큐
  - 다층 캐싱: L1(메모리) + L2(Redis) + L3(DB)
  - 캐시 무효화: 자동 캐시 갱신 전략

검색 엔진:
  - Elasticsearch: 전문 검색 및 분석 (선택적)
  - 텍스트 검색: 크리에이터, 영상 제목 등
  - 자동완성: 실시간 검색 제안
```

### API 통합 & 외부 서비스
```yaml
소셜 미디어 API:
  - YouTube Data API v3: 영상, 채널 정보
  - Twitter API v2: 트윗, 사용자 정보
  - Instagram Basic Display API: 포스트 정보

인증 서비스:
  - JWT: 토큰 기반 인증
  - OAuth 2.0: 소셜 로그인
  - Refresh Token: 토큰 갱신 메커니즘

실시간 통신:
  - WebSocket: 실시간 알림
  - Socket.IO: 크로스 브라우저 호환성
  - Redis Pub/Sub: 분산 메시징
```

### AI/ML & 데이터 처리
```yaml
머신러닝 서비스:
  - TensorFlow.js: 서버사이드 ML
  - Python 서비스: 고급 ML 모델 (선택적)
  - 추천 알고리즘: 협업 필터링, 콘텐츠 기반

데이터 파이프라인:
  - Bull Queue: 백그라운드 작업 처리
  - Cron Jobs: 정기적 데이터 수집
  - Stream Processing: 실시간 데이터 처리
```

### 모니터링 & 보안
```yaml
보안:
  - Rate Limiting: API 호출 제한
  - Helmet.js: 보안 헤더 설정
  - CORS: 크로스 오리진 요청 제어
  - Input Validation: Joi/Zod 스키마 검증

모니터링:
  - Winston: 구조화된 로깅
  - Prometheus: 메트릭 수집
  - Health Checks: 서비스 상태 모니터링
  - Error Tracking: Sentry 연동
```

## 📁 상세 프로젝트 구조

```
my-pick-server/
├── src/
│   ├── app.module.ts                      # 루트 애플리케이션 모듈
│   ├── main.ts                            # 애플리케이션 진입점
│   │
│   ├── config/                            # 설정 관리
│   │   ├── app.config.ts                 # 앱 기본 설정
│   │   ├── database.config.ts            # 데이터베이스 설정
│   │   ├── redis.config.ts               # Redis 설정
│   │   ├── external-api.config.ts        # 외부 API 설정
│   │   ├── auth.config.ts                # 인증 설정
│   │   ├── queue.config.ts               # 큐 설정
│   │   └── index.ts
│   │
│   ├── common/                            # 공통 모듈
│   │   ├── decorators/                   # 커스텀 데코레이터
│   │   │   ├── auth.decorator.ts
│   │   │   ├── api-response.decorator.ts
│   │   │   ├── rate-limit.decorator.ts
│   │   │   └── cache.decorator.ts
│   │   ├── filters/                      # 예외 필터
│   │   │   ├── global-exception.filter.ts
│   │   │   ├── http-exception.filter.ts
│   │   │   └── validation-exception.filter.ts
│   │   ├── guards/                       # 가드
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   ├── rate-limit.guard.ts
│   │   │   └── api-key.guard.ts
│   │   ├── interceptors/                 # 인터셉터
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── cache.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── pipes/                        # 파이프
│   │   │   ├── validation.pipe.ts
│   │   │   ├── parse-objectid.pipe.ts
│   │   │   └── sanitization.pipe.ts
│   │   ├── middleware/                   # 미들웨어
│   │   │   ├── logger.middleware.ts
│   │   │   ├── cors.middleware.ts
│   │   │   └── security.middleware.ts
│   │   ├── utils/                        # 유틸리티
│   │   │   ├── encryption.util.ts
│   │   │   ├── date.util.ts
│   │   │   ├── validation.util.ts
│   │   │   ├── cache-key.util.ts
│   │   │   └── pagination.util.ts
│   │   ├── constants/                    # 상수 정의
│   │   │   ├── cache-keys.constant.ts
│   │   │   ├── queue-names.constant.ts
│   │   │   ├── event-types.constant.ts
│   │   │   └── api-endpoints.constant.ts
│   │   └── interfaces/                   # 공통 인터페이스
│   │       ├── api-response.interface.ts
│   │       ├── pagination.interface.ts
│   │       ├── queue-job.interface.ts
│   │       └── cache.interface.ts
│   │
│   ├── modules/                           # 기능별 모듈
│   │   ├── auth/                         # 인증 모듈
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── local.strategy.ts
│   │   │   ├── oauth.service.ts
│   │   │   ├── dtos/
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── token.dto.ts
│   │   │   │   └── oauth.dto.ts
│   │   │   └── tests/
│   │   │       ├── auth.controller.spec.ts
│   │   │       └── auth.service.spec.ts
│   │   │
│   │   ├── users/                        # 사용자 관리
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── user-profile.entity.ts
│   │   │   │   ├── user-settings.entity.ts
│   │   │   │   └── user-analytics.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   ├── update-user.dto.ts
│   │   │   │   ├── user-response.dto.ts
│   │   │   │   └── user-analytics.dto.ts
│   │   │   └── tests/
│   │   │
│   │   ├── creators/                     # 크리에이터 관리
│   │   │   ├── creators.module.ts
│   │   │   ├── creators.controller.ts
│   │   │   ├── creators.service.ts
│   │   │   ├── creators.repository.ts
│   │   │   ├── entities/
│   │   │   │   ├── creator.entity.ts
│   │   │   │   ├── creator-channel.entity.ts
│   │   │   │   ├── creator-analytics.entity.ts
│   │   │   │   └── creator-category.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── creator.dto.ts
│   │   │   │   ├── creator-search.dto.ts
│   │   │   │   ├── creator-analytics.dto.ts
│   │   │   │   └── subscription.dto.ts
│   │   │   └── subscribers/
│   │   │       ├── creator-analytics.subscriber.ts
│   │   │       └── creator-update.subscriber.ts
│   │   │
│   │   ├── content/                      # 콘텐츠 관리
│   │   │   ├── content.module.ts
│   │   │   ├── content.controller.ts
│   │   │   ├── content.service.ts
│   │   │   ├── content.repository.ts
│   │   │   ├── entities/
│   │   │   │   ├── video.entity.ts
│   │   │   │   ├── post.entity.ts
│   │   │   │   ├── content-metadata.entity.ts
│   │   │   │   └── content-analytics.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── video.dto.ts
│   │   │   │   ├── content-filter.dto.ts
│   │   │   │   ├── content-search.dto.ts
│   │   │   │   └── feed.dto.ts
│   │   │   ├── processors/
│   │   │   │   ├── content-collection.processor.ts
│   │   │   │   ├── content-analysis.processor.ts
│   │   │   │   └── content-cleanup.processor.ts
│   │   │   └── jobs/
│   │   │       ├── collect-youtube-videos.job.ts
│   │   │       ├── collect-twitter-posts.job.ts
│   │   │       └── analyze-content.job.ts
│   │   │
│   │   ├── recommendations/              # 추천 시스템
│   │   │   ├── recommendations.module.ts
│   │   │   ├── recommendations.controller.ts
│   │   │   ├── recommendations.service.ts
│   │   │   ├── engines/
│   │   │   │   ├── collaborative-filtering.engine.ts
│   │   │   │   ├── content-based.engine.ts
│   │   │   │   ├── hybrid-recommendation.engine.ts
│   │   │   │   └── trending.engine.ts
│   │   │   ├── entities/
│   │   │   │   ├── user-preference.entity.ts
│   │   │   │   ├── interaction.entity.ts
│   │   │   │   ├── recommendation.entity.ts
│   │   │   │   └── ml-model.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── recommendation.dto.ts
│   │   │   │   ├── user-preference.dto.ts
│   │   │   │   └── interaction.dto.ts
│   │   │   └── processors/
│   │   │       ├── model-training.processor.ts
│   │   │       ├── recommendation-generation.processor.ts
│   │   │       └── preference-analysis.processor.ts
│   │   │
│   │   ├── notifications/                # 알림 시스템
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.gateway.ts   # WebSocket Gateway
│   │   │   ├── entities/
│   │   │   │   ├── notification.entity.ts
│   │   │   │   ├── notification-setting.entity.ts
│   │   │   │   └── notification-template.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── notification.dto.ts
│   │   │   │   ├── notification-setting.dto.ts
│   │   │   │   └── push-notification.dto.ts
│   │   │   ├── processors/
│   │   │   │   ├── notification-delivery.processor.ts
│   │   │   │   ├── batch-notification.processor.ts
│   │   │   │   └── notification-analytics.processor.ts
│   │   │   └── providers/
│   │   │       ├── push-notification.provider.ts
│   │   │       ├── email-notification.provider.ts
│   │   │       └── websocket-notification.provider.ts
│   │   │
│   │   ├── community/                    # 커뮤니티 기능
│   │   │   ├── community.module.ts
│   │   │   ├── community.controller.ts
│   │   │   ├── community.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── community.entity.ts
│   │   │   │   ├── discussion.entity.ts
│   │   │   │   ├── comment.entity.ts
│   │   │   │   ├── watch-party.entity.ts
│   │   │   │   └── community-member.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── community.dto.ts
│   │   │   │   ├── discussion.dto.ts
│   │   │   │   ├── comment.dto.ts
│   │   │   │   └── watch-party.dto.ts
│   │   │   └── gateways/
│   │   │       ├── community-chat.gateway.ts
│   │   │       └── watch-party.gateway.ts
│   │   │
│   │   ├── analytics/                    # 분석 서비스
│   │   │   ├── analytics.module.ts
│   │   │   ├── analytics.controller.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── user-analytics.entity.ts
│   │   │   │   ├── creator-analytics.entity.ts
│   │   │   │   ├── content-analytics.entity.ts
│   │   │   │   └── platform-analytics.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── analytics-query.dto.ts
│   │   │   │   ├── analytics-response.dto.ts
│   │   │   │   └── dashboard-stats.dto.ts
│   │   │   └── processors/
│   │   │       ├── data-aggregation.processor.ts
│   │   │       ├── insight-generation.processor.ts
│   │   │       └── report-generation.processor.ts
│   │   │
│   │   ├── external-apis/                # 외부 API 연동
│   │   │   ├── external-apis.module.ts
│   │   │   ├── youtube/
│   │   │   │   ├── youtube.module.ts
│   │   │   │   ├── youtube.service.ts
│   │   │   │   ├── youtube-api.client.ts
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── youtube-video.dto.ts
│   │   │   │   │   ├── youtube-channel.dto.ts
│   │   │   │   │   └── youtube-search.dto.ts
│   │   │   │   └── processors/
│   │   │   │       ├── youtube-sync.processor.ts
│   │   │   │       └── youtube-metadata.processor.ts
│   │   │   ├── twitter/
│   │   │   │   ├── twitter.module.ts
│   │   │   │   ├── twitter.service.ts
│   │   │   │   ├── twitter-api.client.ts
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── twitter-post.dto.ts
│   │   │   │   │   ├── twitter-user.dto.ts
│   │   │   │   │   └── twitter-search.dto.ts
│   │   │   │   └── processors/
│   │   │   │       ├── twitter-sync.processor.ts
│   │   │   │       └── twitter-analysis.processor.ts
│   │   │   └── instagram/
│   │   │       ├── instagram.module.ts
│   │   │       ├── instagram.service.ts
│   │   │       └── instagram-api.client.ts
│   │   │
│   │   ├── admin/                        # 관리자 기능
│   │   │   ├── admin.module.ts
│   │   │   ├── admin.controller.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── dtos/
│   │   │   │   ├── admin-dashboard.dto.ts
│   │   │   │   ├── system-health.dto.ts
│   │   │   │   └── moderation.dto.ts
│   │   │   └── tasks/
│   │   │       ├── system-maintenance.task.ts
│   │   │       ├── data-cleanup.task.ts
│   │   │       └── performance-optimization.task.ts
│   │   │
│   │   └── health/                       # 헬스 체크
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       ├── health.service.ts
│   │       └── indicators/
│   │           ├── database.indicator.ts
│   │           ├── redis.indicator.ts
│   │           ├── external-api.indicator.ts
│   │           └── queue.indicator.ts
│   │
│   ├── database/                          # 데이터베이스 관련
│   │   ├── database.module.ts
│   │   ├── database.providers.ts
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.ts
│   │   │   ├── 002_add_analytics_tables.ts
│   │   │   ├── 003_add_community_features.ts
│   │   │   └── 004_add_recommendation_tables.ts
│   │   ├── seeds/
│   │   │   ├── creator.seed.ts
│   │   │   ├── category.seed.ts
│   │   │   └── admin.seed.ts
│   │   └── subscribers/
│   │       ├── analytics.subscriber.ts
│   │       └── audit.subscriber.ts
│   │
│   ├── queue/                             # 큐 시스템
│   │   ├── queue.module.ts
│   │   ├── queue.service.ts
│   │   ├── processors/
│   │   │   ├── content-collection.processor.ts
│   │   │   ├── notification.processor.ts
│   │   │   ├── analytics.processor.ts
│   │   │   └── recommendation.processor.ts
│   │   └── jobs/
│   │       ├── scheduled-content-sync.job.ts
│   │       ├── user-analytics.job.ts
│   │       └── cleanup.job.ts
│   │
│   ├── cache/                             # 캐시 관리
│   │   ├── cache.module.ts
│   │   ├── cache.service.ts
│   │   ├── redis.service.ts
│   │   ├── strategies/
│   │   │   ├── lru-cache.strategy.ts
│   │   │   ├── redis-cache.strategy.ts
│   │   │   └── multi-level-cache.strategy.ts
│   │   └── decorators/
│   │       ├── cacheable.decorator.ts
│   │       └── cache-evict.decorator.ts
│   │
│   ├── websockets/                        # WebSocket 관리
│   │   ├── websockets.module.ts
│   │   ├── websockets.service.ts
│   │   ├── gateways/
│   │   │   ├── notifications.gateway.ts
│   │   │   ├── community.gateway.ts
│   │   │   └── watch-party.gateway.ts
│   │   ├── guards/
│   │   │   ├── ws-auth.guard.ts
│   │   │   └── ws-throttle.guard.ts
│   │   └── adapters/
│   │       ├── redis.adapter.ts
│   │       └── cluster.adapter.ts
│   │
│   └── shared/                            # 공유 모듈
│       ├── shared.module.ts
│       ├── logger/
│       │   ├── logger.module.ts
│       │   ├── logger.service.ts
│       │   └── winston.config.ts
│       ├── email/
│       │   ├── email.module.ts
│       │   ├── email.service.ts
│       │   └── templates/
│       ├── file-storage/
│       │   ├── storage.module.ts
│       │   ├── storage.service.ts
│       │   └── providers/
│       │       ├── local.provider.ts
│       │       ├── s3.provider.ts
│       │       └── cloudinary.provider.ts
│       └── metrics/
│           ├── metrics.module.ts
│           ├── metrics.service.ts
│           └── prometheus.config.ts
│
├── test/                                  # 테스트
│   ├── e2e/                              # E2E 테스트
│   │   ├── auth.e2e-spec.ts
│   │   ├── creators.e2e-spec.ts
│   │   ├── content.e2e-spec.ts
│   │   └── recommendations.e2e-spec.ts
│   ├── integration/                      # 통합 테스트
│   │   ├── database.integration.spec.ts
│   │   ├── external-api.integration.spec.ts
│   │   └── queue.integration.spec.ts
│   ├── fixtures/                         # 테스트 데이터
│   │   ├── users.fixture.ts
│   │   ├── creators.fixture.ts
│   │   └── content.fixture.ts
│   ├── mocks/                           # 모킹 데이터
│   │   ├── youtube-api.mock.ts
│   │   ├── twitter-api.mock.ts
│   │   └── database.mock.ts
│   └── utils/                           # 테스트 유틸리티
│       ├── test-database.ts
│       ├── test-cache.ts
│       └── test-auth.ts
│
├── docs/                                 # 프로젝트 문서
│   ├── api/                             # API 문서
│   │   ├── swagger.yaml
│   │   ├── postman-collection.json
│   │   └── api-examples.md
│   ├── architecture/                    # 아키텍처 문서
│   │   ├── system-design.md
│   │   ├── database-schema.md
│   │   ├── api-design.md
│   │   └── security.md
│   ├── deployment/                      # 배포 문서
│   │   ├── docker.md
│   │   ├── kubernetes.md
│   │   ├── monitoring.md
│   │   └── scaling.md
│   └── development/                     # 개발 가이드
│       ├── getting-started.md
│       ├── coding-standards.md
│       ├── testing.md
│       └── debugging.md
│
├── scripts/                             # 유틸리티 스크립트
│   ├── build.sh                        # 빌드 스크립트
│   ├── deploy.sh                       # 배포 스크립트
│   ├── seed-data.sh                    # 시드 데이터 생성
│   ├── backup-db.sh                    # 데이터베이스 백업
│   └── performance-test.sh             # 성능 테스트
│
├── .env.example                         # 환경 변수 예시
├── .env.local                          # 로컬 환경 변수
├── .env.production                     # 프로덕션 환경 변수
├── .gitignore                          # Git 무시 파일
├── Dockerfile                          # Docker 설정
├── docker-compose.yml                  # Docker Compose 설정
├── docker-compose.prod.yml            # 프로덕션 Docker Compose
├── nest-cli.json                       # NestJS CLI 설정
├── tsconfig.json                       # TypeScript 설정
├── tsconfig.build.json                # 빌드용 TypeScript 설정
├── package.json                        # 패키지 설정
├── package-lock.json                   # 패키지 잠금 파일
├── jest.config.js                      # Jest 테스트 설정
├── eslint.config.js                    # ESLint 설정
├── prettier.config.js                  # Prettier 설정
└── README.md                           # 프로젝트 설명
```

## 🚀 핵심 기능 구현

### 1. 외부 API 통합 시스템
```typescript
// YouTube API 통합 예시
@Injectable()
export class YouTubeApiService {
  private readonly httpService: HttpService;
  private readonly cacheService: CacheService;
  
  constructor(
    @Inject(YOUTUBE_CONFIG) private config: YouTubeConfig,
    httpService: HttpService,
    cacheService: CacheService,
  ) {
    this.httpService = httpService;
    this.cacheService = cacheService;
  }
  
  @Cacheable('youtube:channel', { ttl: 3600 })
  async getChannelInfo(channelId: string): Promise<ChannelInfo> {
    const response = await this.httpService.axiosRef.get(
      `${this.config.baseUrl}/channels`,
      {
        params: {
          part: 'snippet,statistics,brandingSettings',
          id: channelId,
          key: this.config.apiKey,
        },
      }
    );
    
    return this.transformChannelData(response.data);
  }
  
  @Cacheable('youtube:videos', { ttl: 1800 })
  async getChannelVideos(
    channelId: string, 
    options: PaginationOptions = {}
  ): Promise<PaginatedVideos> {
    // 최신 영상 목록 조회
    const response = await this.httpService.axiosRef.get(
      `${this.config.baseUrl}/search`,
      {
        params: {
          part: 'snippet',
          channelId,
          type: 'video',
          order: 'date',
          maxResults: options.limit || 50,
          pageToken: options.pageToken,
          key: this.config.apiKey,
        },
      }
    );
    
    return this.transformVideoData(response.data);
  }
  
  // 실시간 데이터 수집 스케줄러
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncChannelData(): Promise<void> {
    const activeChannels = await this.creatorService.getActiveChannels();
    
    for (const channel of activeChannels) {
      await this.queueService.add('sync-channel-videos', {
        channelId: channel.id,
        priority: channel.priority,
      });
    }
  }
}
```

### 2. 실시간 알림 시스템
```typescript
// WebSocket 기반 실시간 알림
@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: '*' },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  constructor(
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
  ) {}
  
  async handleConnection(client: Socket) {
    try {
      // JWT 토큰 검증
      const token = client.handshake.auth.token;
      const user = await this.authService.validateToken(token);
      
      // 사용자 연결 정보 저장
      await this.redisService.set(
        `user:${user.id}:socket`,
        client.id,
        3600 // 1시간 TTL
      );
      
      // 사용자별 방 참가
      client.join(`user:${user.id}`);
      
      // 미확인 알림 전송
      const unreadNotifications = await this.notificationService
        .getUnreadNotifications(user.id);
      
      client.emit('unread-notifications', unreadNotifications);
      
    } catch (error) {
      client.disconnect();
    }
  }
  
  async handleDisconnect(client: Socket) {
    // 연결 정보 정리
    const userId = await this.getUserIdBySocketId(client.id);
    if (userId) {
      await this.redisService.del(`user:${userId}:socket`);
    }
  }
  
  // 실시간 알림 전송
  async sendNotification(userId: number, notification: NotificationData) {
    // 데이터베이스에 저장
    await this.notificationService.createNotification(userId, notification);
    
    // 실시간 전송
    this.server.to(`user:${userId}`).emit('new-notification', notification);
    
    // 푸시 알림 (백그라운드)
    await this.queueService.add('send-push-notification', {
      userId,
      notification,
    });
  }
  
  // 배치 알림 처리
  @Cron(CronExpression.EVERY_MINUTE)
  async processBatchNotifications() {
    const pendingNotifications = await this.notificationService
      .getPendingBatchNotifications();
    
    for (const batch of pendingNotifications) {
      await this.sendBatchNotification(batch);
    }
  }
}
```

### 3. AI 기반 추천 시스템
```typescript
// 하이브리드 추천 엔진
@Injectable()
export class HybridRecommendationEngine {
  constructor(
    private readonly collaborativeEngine: CollaborativeFilteringEngine,
    private readonly contentBasedEngine: ContentBasedEngine,
    private readonly trendingEngine: TrendingEngine,
    private readonly userProfileService: UserProfileService,
  ) {}
  
  async generateRecommendations(
    userId: number,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult> {
    // 사용자 프로필 분석
    const userProfile = await this.userProfileService.getUserProfile(userId);
    
    // 여러 엔진에서 추천 생성
    const [collaborative, contentBased, trending] = await Promise.all([
      this.collaborativeEngine.recommend(userId, { ...options, weight: 0.4 }),
      this.contentBasedEngine.recommend(userId, { ...options, weight: 0.4 }),
      this.trendingEngine.recommend(userId, { ...options, weight: 0.2 }),
    ]);
    
    // 추천 결과 융합
    const hybridResults = this.fuseRecommendations([
      collaborative,
      contentBased,
      trending,
    ]);
    
    // 다양성 증진
    const diversifiedResults = this.diversifyRecommendations(
      hybridResults,
      userProfile.diversityPreference
    );
    
    // 개인화 점수 계산
    const personalizedResults = await this.calculatePersonalizationScores(
      diversifiedResults,
      userProfile
    );
    
    return {
      recommendations: personalizedResults,
      metadata: {
        algorithmsUsed: ['collaborative', 'content-based', 'trending'],
        userProfileVersion: userProfile.version,
        generatedAt: new Date(),
        refreshInterval: this.calculateRefreshInterval(userProfile),
      },
    };
  }
  
  // 협업 필터링 엔진
  private async generateCollaborativeRecommendations(
    userId: number
  ): Promise<RecommendationItem[]> {
    // 유사 사용자 찾기
    const similarUsers = await this.findSimilarUsers(userId, 100);
    
    // 유사 사용자들이 좋아한 콘텐츠 분석
    const candidateItems = await this.getCandidateItems(similarUsers);
    
    // 사용자가 이미 소비한 콘텐츠 제외
    const unseenItems = await this.filterUnseenItems(userId, candidateItems);
    
    // 추천 점수 계산
    return this.calculateCollaborativeScores(userId, unseenItems);
  }
  
  // 콘텐츠 기반 엔진
  private async generateContentBasedRecommendations(
    userId: number
  ): Promise<RecommendationItem[]> {
    // 사용자 선호도 프로필
    const preferences = await this.getUserContentPreferences(userId);
    
    // 콘텐츠 특성 분석
    const contentFeatures = await this.getContentFeatures();
    
    // 유사도 계산
    const similarities = this.calculateContentSimilarity(
      preferences,
      contentFeatures
    );
    
    return this.rankContentBasedRecommendations(similarities);
  }
  
  // 실시간 학습 및 모델 업데이트
  @Cron(CronExpression.EVERY_HOUR)
  async updateRecommendationModels() {
    // 최근 사용자 상호작용 데이터 수집
    const recentInteractions = await this.getRecentInteractions(1); // 1시간
    
    // 온라인 학습
    await this.updateCollaborativeModel(recentInteractions);
    await this.updateContentModel(recentInteractions);
    
    // 모델 성능 평가
    const performance = await this.evaluateModelPerformance();
    
    // 성능 저하 시 재학습
    if (performance.accuracy < 0.75) {
      await this.scheduleModelRetraining();
    }
  }
}
```

### 4. 고성능 데이터 파이프라인
```typescript
// 콘텐츠 수집 파이프라인
@Processor('content-collection')
export class ContentCollectionProcessor {
  constructor(
    private readonly youtubeService: YouTubeApiService,
    private readonly twitterService: TwitterApiService,
    private readonly contentService: ContentService,
    private readonly analyticsService: AnalyticsService,
  ) {}
  
  @Process('sync-creator-content')
  async syncCreatorContent(job: Job<SyncCreatorContentJob>) {
    const { creatorId, platforms, priority } = job.data;
    
    try {
      // 병렬 플랫폼 동기화
      const syncPromises = platforms.map(platform => 
        this.syncPlatformContent(creatorId, platform)
      );
      
      const results = await Promise.allSettled(syncPromises);
      
      // 결과 처리 및 분석
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      // 성공한 데이터 저장
      for (const result of successful) {
        const contentData = (result as PromiseFulfilledResult<any>).value;
        await this.processContentData(creatorId, contentData);
      }
      
      // 실패 로깅 및 재시도 스케줄링
      if (failed.length > 0) {
        await this.handleSyncFailures(creatorId, failed);
      }
      
      // 분석 트리거
      await this.triggerContentAnalysis(creatorId);
      
    } catch (error) {
      // 에러 처리 및 알림
      await this.handleSyncError(creatorId, error);
      throw error; // Bull에서 재시도 처리
    }
  }
  
  private async syncPlatformContent(
    creatorId: number,
    platform: Platform
  ): Promise<ContentData[]> {
    switch (platform.type) {
      case 'youtube':
        return this.syncYouTubeContent(creatorId, platform);
      case 'twitter':
        return this.syncTwitterContent(creatorId, platform);
      default:
        throw new Error(`Unsupported platform: ${platform.type}`);
    }
  }
  
  private async syncYouTubeContent(
    creatorId: number,
    platform: Platform
  ): Promise<ContentData[]> {
    const lastSync = await this.getLastSyncTime(creatorId, 'youtube');
    const newVideos = await this.youtubeService.getNewVideos(
      platform.channelId,
      lastSync
    );
    
    // 콘텐츠 메타데이터 추출
    const enrichedVideos = await Promise.all(
      newVideos.map(video => this.enrichVideoMetadata(video))
    );
    
    return enrichedVideos;
  }
  
  // 실시간 스트리밍 데이터 처리
  @Process('process-streaming-data')
  async processStreamingData(job: Job<StreamingDataJob>) {
    const { streamType, data } = job.data;
    
    // 스트리밍 데이터 파싱
    const parsedData = await this.parseStreamingData(streamType, data);
    
    // 실시간 업데이트
    await this.updateRealTimeMetrics(parsedData);
    
    // 관련 사용자들에게 알림
    await this.notifyInterestedUsers(parsedData);
  }
}
```

### 5. 확장 가능한 캐싱 전략
```typescript
// 다층 캐싱 시스템
@Injectable()
export class MultiLevelCacheService {
  private readonly l1Cache: LRUCache<string, any>; // 메모리 캐시
  private readonly l2Cache: Redis; // Redis 캐시
  
  constructor(
    @Inject('REDIS_CLIENT') private redis: Redis,
    @Inject('CACHE_CONFIG') private config: CacheConfig,
  ) {
    this.l1Cache = new LRUCache({
      max: config.l1MaxSize,
      ttl: config.l1Ttl,
    });
    this.l2Cache = redis;
  }
  
  async get<T>(key: string): Promise<T | null> {
    // L1 캐시 확인
    const l1Result = this.l1Cache.get(key);
    if (l1Result) {
      return l1Result as T;
    }
    
    // L2 캐시 확인
    const l2Result = await this.l2Cache.get(key);
    if (l2Result) {
      const parsed = JSON.parse(l2Result);
      
      // L1 캐시에 저장
      this.l1Cache.set(key, parsed);
      
      return parsed as T;
    }
    
    return null;
  }
  
  async set<T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    
    // L1 캐시에 저장
    this.l1Cache.set(key, value);
    
    // L2 캐시에 저장
    if (ttl) {
      await this.l2Cache.setex(key, ttl, serialized);
    } else {
      await this.l2Cache.set(key, serialized);
    }
  }
  
  // 캐시 무효화 전략
  async invalidatePattern(pattern: string): Promise<void> {
    // L1 캐시 패턴 매칭 삭제
    for (const key of this.l1Cache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.l1Cache.delete(key);
      }
    }
    
    // L2 캐시 패턴 매칭 삭제
    const keys = await this.l2Cache.keys(pattern);
    if (keys.length > 0) {
      await this.l2Cache.del(...keys);
    }
  }
  
  // 스마트 캐시 워밍
  async warmupCache(keys: string[]): Promise<void> {
    const promises = keys.map(async (key) => {
      const cached = await this.get(key);
      if (!cached) {
        // 캐시 미스 시 데이터 로드 및 캐싱
        const data = await this.loadDataForKey(key);
        if (data) {
          await this.set(key, data);
        }
      }
    });
    
    await Promise.all(promises);
  }
}
```

## 🔧 개발 환경 설정

### 환경 변수 설정
```bash
# .env.example
# 데이터베이스
DATABASE_URL=postgresql://user:password@localhost:5432/mypick
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=mypick_user
DATABASE_PASSWORD=secure_password
DATABASE_NAME=mypick_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# JWT 설정
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=3600
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=604800

# 외부 API
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_API_URL=https://www.googleapis.com/youtube/v3

TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# 큐 시스템
QUEUE_REDIS_URL=redis://localhost:6379
QUEUE_DASHBOARD_PORT=3001

# 파일 스토리지
STORAGE_TYPE=local # local, s3, cloudinary
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket

# 이메일
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# 모니터링
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# 애플리케이션
APP_PORT=4000
APP_ENV=development
APP_URL=http://localhost:4000
CLIENT_URL=http://localhost:3000

# 캐시 설정
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 개발 시작하기
```bash
# 1. 저장소 클론
git clone https://github.com/your-org/my-pick-server.git
cd my-pick-server

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집

# 4. 데이터베이스 설정
npm run db:create
npm run db:migrate
npm run db:seed

# 5. Redis 시작 (Docker 사용)
docker run -d -p 6379:6379 redis:7-alpine

# 6. 개발 서버 시작
npm run start:dev

# 7. API 문서 확인
# http://localhost:4000/api/docs (Swagger)
```

### 주요 개발 명령어
```json
{
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    
    "build": "nest build",
    "build:prod": "NODE_ENV=production nest build",
    
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "type-check": "tsc --noEmit",
    
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    
    "db:create": "npm run typeorm -- schema:sync",
    "db:migrate": "npm run typeorm -- migration:run",
    "db:migrate:revert": "npm run typeorm -- migration:revert",
    "db:seed": "npm run typeorm -- migration:run --config ormconfig-seed.js",
    "db:drop": "npm run typeorm -- schema:drop",
    
    "queue:dashboard": "bull-monitor",
    "cache:clear": "node scripts/clear-cache.js",
    "logs:tail": "tail -f logs/app.log"
  }
}
```

## 🧪 테스트 전략

### 테스트 구조
```typescript
// 단위 테스트 예시
describe('CreatorService', () => {
  let service: CreatorService;
  let repository: Repository<Creator>;
  let cacheService: CacheService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorService,
        {
          provide: getRepositoryToken(Creator),
          useClass: Repository,
        },
        {
          provide: CacheService,
          useValue: createMockCacheService(),
        },
      ],
    }).compile();
    
    service = module.get<CreatorService>(CreatorService);
    repository = module.get<Repository<Creator>>(getRepositoryToken(Creator));
    cacheService = module.get<CacheService>(CacheService);
  });
  
  describe('getCreatorById', () => {
    it('캐시에서 크리에이터를 찾으면 반환해야 함', async () => {
      const creatorId = 1;
      const cachedCreator = createMockCreator({ id: creatorId });
      
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedCreator);
      
      const result = await service.getCreatorById(creatorId);
      
      expect(result).toEqual(cachedCreator);
      expect(cacheService.get).toHaveBeenCalledWith(`creator:${creatorId}`);
    });
    
    it('캐시 미스 시 데이터베이스에서 조회하고 캐시에 저장해야 함', async () => {
      const creatorId = 1;
      const dbCreator = createMockCreator({ id: creatorId });
      
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(repository, 'findOne').mockResolvedValue(dbCreator);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      
      const result = await service.getCreatorById(creatorId);
      
      expect(result).toEqual(dbCreator);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: creatorId } });
      expect(cacheService.set).toHaveBeenCalledWith(`creator:${creatorId}`, dbCreator);
    });
  });
});

// 통합 테스트 예시
describe('YouTube API Integration', () => {
  let app: INestApplication;
  let youtubeService: YouTubeApiService;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider('YOUTUBE_CONFIG')
    .useValue(testYouTubeConfig)
    .compile();
    
    app = moduleFixture.createNestApplication();
    youtubeService = moduleFixture.get<YouTubeApiService>(YouTubeApiService);
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('유효한 채널 ID로 채널 정보를 가져와야 함', async () => {
    const channelId = 'UCTest123';
    
    // 실제 API 호출 대신 모킹된 응답 사용
    nock('https://www.googleapis.com')
      .get('/youtube/v3/channels')
      .query(true)
      .reply(200, mockYouTubeChannelResponse);
    
    const result = await youtubeService.getChannelInfo(channelId);
    
    expect(result).toBeDefined();
    expect(result.id).toBe(channelId);
    expect(result.snippet.title).toBeDefined();
  });
});

// E2E 테스트 예시
describe('Creators API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
    
    // 테스트용 사용자 로그인
    authToken = await getTestAuthToken(app);
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('/creators (GET) - 구독한 크리에이터 목록 조회', () => {
    return request(app.getHttpServer())
      .get('/creators')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.pagination).toBeDefined();
      });
  });
  
  it('/creators/:id/subscribe (POST) - 크리에이터 구독', async () => {
    const creatorId = await createTestCreator();
    
    return request(app.getHttpServer())
      .post(`/creators/${creatorId}/subscribe`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.subscribed).toBe(true);
      });
  });
});
```

## 📊 성능 최적화 및 모니터링

### 성능 최적화 전략
```typescript
// 데이터베이스 쿼리 최적화
@Injectable()
export class OptimizedCreatorService {
  constructor(
    @InjectRepository(Creator)
    private creatorRepository: Repository<Creator>,
  ) {}
  
  // N+1 문제 해결을 위한 eager loading
  async getCreatorsWithVideos(userId: number): Promise<Creator[]> {
    return this.creatorRepository
      .createQueryBuilder('creator')
      .leftJoinAndSelect('creator.videos', 'video')
      .leftJoinAndSelect('creator.subscriptions', 'subscription')
      .where('subscription.userId = :userId', { userId })
      .andWhere('video.publishedAt > :since', {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일
      })
      .orderBy('video.publishedAt', 'DESC')
      .limit(100)
      .getMany();
  }
  
  // 배치 처리로 대량 데이터 효율적 처리
  async batchUpdateCreatorStats(): Promise<void> {
    const batchSize = 100;
    let offset = 0;
    
    while (true) {
      const creators = await this.creatorRepository.find({
        skip: offset,
        take: batchSize,
      });
      
      if (creators.length === 0) break;
      
      // 병렬 처리로 성능 향상
      await Promise.all(
        creators.map(creator => this.updateCreatorStats(creator))
      );
      
      offset += batchSize;
    }
  }
}

// 응답 시간 모니터링
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        
        // 느린 쿼리 로깅
        if (responseTime > 1000) {
          console.warn(`Slow request: ${request.method} ${request.url} - ${responseTime}ms`);
        }
        
        // 메트릭 수집
        this.recordMetric('api.response_time', responseTime, {
          method: request.method,
          endpoint: request.route?.path,
        });
      }),
    );
  }
  
  private recordMetric(name: string, value: number, tags: Record<string, string>) {
    // Prometheus 메트릭 기록
    httpRequestDuration.labels(tags).observe(value / 1000);
  }
}
```

### 실시간 모니터링 대시보드
```typescript
// 헬스 체크 시스템
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private youtube: YouTubeHealthIndicator,
  ) {}
  
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      // 데이터베이스 상태
      () => this.db.pingCheck('database'),
      
      // Redis 상태
      () => this.redis.pingCheck('redis'),
      
      // 외부 API 상태
      () => this.youtube.isHealthy('youtube-api'),
      
      // 메모리 사용량
      () => this.checkMemoryUsage(),
      
      // 큐 상태
      () => this.checkQueueHealth(),
    ]);
  }
  
  private async checkMemoryUsage(): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB
    
    const isHealthy = memoryUsage.heapUsed < maxMemory;
    
    return {
      memory: {
        status: isHealthy ? 'up' : 'down',
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
    };
  }
}

// 실시간 메트릭 수집
@Injectable()
export class MetricsService {
  private readonly prometheus = register;
  
  // 커스텀 메트릭 정의
  private readonly userLoginCounter = new Counter({
    name: 'user_logins_total',
    help: 'Total number of user logins',
    labelNames: ['method'],
  });
  
  private readonly recommendationLatency = new Histogram({
    name: 'recommendation_duration_seconds',
    help: 'Time spent generating recommendations',
    buckets: [0.1, 0.5, 1, 2, 5],
  });
  
  private readonly activeUsersGauge = new Gauge({
    name: 'active_users_current',
    help: 'Current number of active users',
  });
  
  recordUserLogin(method: string) {
    this.userLoginCounter.inc({ method });
  }
  
  recordRecommendationLatency(duration: number) {
    this.recommendationLatency.observe(duration);
  }
  
  updateActiveUsers(count: number) {
    this.activeUsersGauge.set(count);
  }
  
  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics() {
    // 시스템 리소스 메트릭
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = process.memoryUsage();
    const activeConnections = await this.getActiveConnections();
    
    // Prometheus에 기록
    systemCpuUsage.set(cpuUsage);
    systemMemoryUsage.set(memoryUsage.heapUsed);
    activeConnectionsGauge.set(activeConnections);
  }
}
```

## 🚀 배포 및 운영

### Docker 컨테이너화
```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "start:dev"]

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine AS production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package.json ./
USER nestjs
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "dist/main"]
```

### Docker Compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: development
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/mypick
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
    command: npm run start:dev

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mypick
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### CI/CD 파이프라인
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:cov
      
      - name: Run e2e tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            docker pull ghcr.io/${{ github.repository }}:latest
            docker-compose -f /opt/mypick/docker-compose.prod.yml up -d --no-deps app
            docker system prune -f
```

## 🔮 확장 계획 및 아키텍처 진화

### 마이크로서비스 분할 계획
```yaml
Phase 1: 모놀리스 분할 준비
  - 도메인 경계 명확화
  - 서비스 간 인터페이스 정의
  - 데이터베이스 분리 준비

Phase 2: 핵심 서비스 분리
  services:
    - auth-service: 인증 및 사용자 관리
    - creator-service: 크리에이터 정보 관리
    - content-service: 콘텐츠 수집 및 저장
    - recommendation-service: 추천 엔진
    - notification-service: 알림 시스템

Phase 3: 지원 서비스 분리
  services:
    - analytics-service: 분석 및 리포팅
    - community-service: 커뮤니티 기능
    - media-service: 미디어 처리
    - search-service: 검색 엔진
```

### 글로벌 확장 아키텍처
```typescript
// 다중 리전 지원 설계
interface GlobalArchitecture {
  regions: {
    primary: 'us-east-1';     // 미국 동부
    secondary: 'ap-northeast-1'; // 일본 (아시아)
    tertiary: 'eu-west-1';    // 유럽
  };
  
  dataStrategy: {
    userProfiles: 'regional';     // 지역별 분산
    creatorData: 'global';        // 전역 복제
    contentMetadata: 'cached';    // 캐시 기반
    analytics: 'aggregated';      // 중앙 집계
  };
  
  networkOptimization: {
    cdn: 'cloudflare';           // 글로벌 CDN
    edgeComputing: 'enabled';     // 엣지 컴퓨팅
    smartRouting: 'latency-based'; // 지연 시간 기반 라우팅
  };
}
```

## 🤝 개발 가이드라인

### API 설계 원칙
```typescript
// RESTful API 설계 표준
interface ApiDesignStandards {
  endpoints: {
    // 리소스 중심 URL
    creators: '/api/v1/creators';
    creatorById: '/api/v1/creators/:id';
    creatorVideos: '/api/v1/creators/:id/videos';
    
    // 계층적 리소스
    userSubscriptions: '/api/v1/users/:userId/subscriptions';
    userRecommendations: '/api/v1/users/:userId/recommendations';
  };
  
  httpMethods: {
    GET: '조회';
    POST: '생성';
    PUT: '전체 수정';
    PATCH: '부분 수정';
    DELETE: '삭제';
  };
  
  responseFormat: {
    success: {
      data: any;
      pagination?: PaginationInfo;
      metadata?: ResponseMetadata;
    };
    error: {
      error: {
        code: string;
        message: string;
        details?: any;
      };
    };
  };
}

// GraphQL 스키마 (미래 확장)
const typeDefs = gql`
  type Creator {
    id: ID!
    name: String!
    avatar: String
    platforms: [Platform!]!
    videos(first: Int, after: String): VideoConnection!
    analytics: CreatorAnalytics!
  }
  
  type Video {
    id: ID!
    title: String!
    description: String
    thumbnail: String!
    publishedAt: DateTime!
    creator: Creator!
    statistics: VideoStatistics!
  }
  
  type Query {
    creators(filter: CreatorFilter): [Creator!]!
    recommendations(userId: ID!): [Video!]!
    feed(userId: ID!, first: Int, after: String): VideoConnection!
  }
  
  type Mutation {
    subscribeToCreator(creatorId: ID!): SubscriptionResult!
    unsubscribeFromCreator(creatorId: ID!): SubscriptionResult!
    updateUserPreferences(preferences: UserPreferencesInput!): User!
  }
  
  type Subscription {
    newVideoFromSubscriptions(userId: ID!): Video!
    notificationReceived(userId: ID!): Notification!
  }
`;
```

### 코드 품질 가이드라인
```typescript
// 코딩 표준 예시
@Injectable()
export class ExampleService {
  constructor(
    private readonly repository: Repository<Entity>,
    private readonly cacheService: CacheService,
    private readonly logger: Logger,
  ) {}
  
  // 명확한 메서드 이름과 타입 정의
  async findEntityWithCache(
    id: number,
    options?: FindOptions
  ): Promise<Entity | null> {
    // 캐시 확인
    const cacheKey = `entity:${id}`;
    const cached = await this.cacheService.get<Entity>(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache hit for entity ${id}`);
      return cached;
    }
    
    // 데이터베이스 조회
    const entity = await this.repository.findOne({
      where: { id },
      ...options,
    });
    
    // 캐싱
    if (entity) {
      await this.cacheService.set(cacheKey, entity, 3600);
      this.logger.debug(`Cached entity ${id}`);
    }
    
    return entity;
  }
  
  // 에러 핸들링 패턴
  async createEntity(data: CreateEntityDto): Promise<Entity> {
    try {
      // 검증
      await this.validateEntityData(data);
      
      // 생성
      const entity = this.repository.create(data);
      const saved = await this.repository.save(entity);
      
      // 캐시 무효화
      await this.cacheService.invalidatePattern('entity:*');
      
      this.logger.info(`Created entity ${saved.id}`);
      return saved;
      
    } catch (error) {
      this.logger.error(`Failed to create entity`, {
        error: error.message,
        data,
      });
      
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      
      throw new InternalServerErrorException('Failed to create entity');
    }
  }
}
```

---

> **MyPick Server**는 현대적인 백엔드 아키텍처 패턴과 확장 가능한 설계를 통해 크리에이터 팬덤 생태계의 핵심 인프라를 제공합니다. 🚀