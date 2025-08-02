# MyPick Server 개발 계획

## 📋 개발 전략 개요

세 문서를 분석한 결과, 현재 my-pick-server는 **크리에이터 콘텐츠 허브 서비스**의 백엔드로, 도메인별로 체계적으로 설계된 아키텍처를 가지고 있습니다.

## 🎯 우선순위별 개발 로드맵

### **Phase 1: 핵심 도메인 구축 (2-3주)**

#### 1.1 Creator 도메인 (1주차)
- ✅ 이미 CLAUDE.md에서 상당부분 설계 완료
- **개발 작업**:
  - CreatorEntity, CreatorPlatformEntity, CreatorConsentEntity 구현
  - CreatorService (krgeobuk 표준 패턴 적용)
  - CreatorController (REST API)
  - CreatorRepository 최적화
  - 외래키 기반 관계 구현

#### 1.2 User-Subscription 중간테이블 (1주차 후반)
- **개발 작업**:
  - UserSubscriptionEntity 구현
  - UserSubscriptionService (중간테이블 표준 패턴)
  - 구독/구독해제 API
  - 배치 조회 최적화

#### 1.3 Creator-Application 도메인 (2주차)
- **개발 작업**:
  - CreatorApplicationEntity 구현
  - 신청 워크플로우 서비스
  - 관리자 승인/거부 API
  - 신청 상태 추적 기능

### **Phase 2: 콘텐츠 관리 시스템 (2-3주)**

#### 2.1 Content 도메인 (3주차)
- **개발 작업**:
  - ContentEntity, ContentStatisticsEntity 구현
  - ContentService (검색, 필터링 최적화)
  - 콘텐츠 피드 API
  - 통계 집계 서비스

#### 2.2 User-Interaction 중간테이블 (4주차)
- **개발 작업**:
  - UserInteractionEntity 구현
  - 북마크, 좋아요, 시청기록 관리
  - 사용자 행동 데이터 수집
  - 개인화를 위한 데이터 파이프라인

### **Phase 3: 외부 API 통합 (2주)**

#### 3.1 YouTube API 통합 (5주차)
- **개발 작업**:
  - YouTubeApiService 구현
  - 채널 정보 수집 스케줄러
  - 영상 메타데이터 동기화
  - 레이트 리미팅 및 에러 처리

#### 3.2 Twitter API 통합 (5주차 후반)
- **개발 작업**:
  - TwitterApiService 구현
  - 트윗 수집 파이프라인
  - 실시간 데이터 처리

### **Phase 4: 실시간 알림 시스템 (1-2주)**

#### 4.1 Notification 도메인 + WebSocket (6주차)
- **개발 작업**:
  - NotificationEntity, NotificationSettingsEntity 구현
  - WebSocket Gateway (Socket.IO)
  - 실시간 알림 전송
  - 푸시 알림 연동

### **Phase 5: 기본 추천 시스템 (1주)**

#### 5.1 간단한 추천 엔진 (7주차)
- **개발 작업**:
  - 구독 기반 추천
  - 카테고리 기반 추천
  - 트렌딩 콘텐츠 식별
  - 추천 피드백 수집

### **Phase 6: 관리자 시스템 (1주)**

#### 6.1 Admin 도메인 (8주차)
- **개발 작업**:
  - 관리자 대시보드 API
  - 크리에이터 신청 관리
  - 시스템 통계 조회
  - 콘텐츠 모더레이션 기능

## 🛠 기술적 구현 전략

### 1. 개발 환경 설정
```bash
# 기본 NestJS 프로젝트 구조
# project-info.md의 상세 디렉토리 구조 참고
# krgeobuk 공유 라이브러리 연동
```

### 2. 데이터베이스 설계
- **MySQL 8** 사용 (project-info.md 명시)
- **TypeORM** ORM 사용
- **외래키 기반 관계** (TypeORM 관계 데코레이터 제거)
- **적절한 인덱싱** 전략 적용

### 3. 캐싱 전략
- **Redis** 다층 캐싱 (L1: 메모리, L2: Redis)
- **쿼리 결과 캐싱** 및 **스마트 무효화**
- **실시간 데이터**는 짧은 TTL 적용

### 4. API 설계
- **RESTful API** 표준 준수
- **krgeobuk 표준 패턴** 적용
- **v1 제거된 URL 구조** (`/api/creators`)
- **적절한 HTTP 상태 코드** 및 **에러 응답**

### 5. 성능 최적화
- **데이터베이스 쿼리 최적화** (N+1 문제 방지)
- **배치 처리** 및 **병렬 처리**
- **백그라운드 작업**을 위한 **Bull Queue** 사용
- **페이지네이션** 및 **필터링** 최적화

## 🔄 마이크로서비스 연동

### 기존 서비스와의 연동
- **auth-server**: 사용자 인증 및 정보 조회
- **authz-server**: 권한 검증
- **TCP 클라이언트** 활용 (이미 구현됨)

### 서비스 간 통신
- **TCP 메시지 패턴**: `{domain}.{operation}`
- **타임아웃 및 재시도** 로직
- **서킷 브레이커** 패턴 적용

## 🧪 테스트 전략

### 테스트 레벨
- **단위 테스트**: 각 서비스 메서드
- **통합 테스트**: 데이터베이스 연동
- **E2E 테스트**: API 엔드포인트
- **외부 API 모킹**: YouTube, Twitter API

### CI/CD 파이프라인
- **GitHub Actions** 기반
- **Docker 컨테이너화**
- **자동 배포** 및 **롤백**

## 📊 모니터링 및 운영

### 성능 모니터링
- **Prometheus** 메트릭 수집
- **응답 시간** 및 **에러율** 추적
- **헬스 체크** 엔드포인트

### 로깅 전략
- **Winston** 구조화된 로깅
- **적절한 로그 레벨** (ERROR/WARN/LOG/DEBUG)
- **메타데이터 포함** 로깅

## 🎯 성공 지표

### 기술적 목표
- **응답 시간**: 95%의 API가 200ms 이하
- **가용성**: 99.9% 업타임
- **동시 사용자**: 10,000명 지원
- **데이터 동기화**: 5분 이내 최신화

### 비즈니스 목표
- **크리에이터 등록**: 1,000명 이상
- **콘텐츠 수집**: 일일 10,000개 이상
- **사용자 참여**: 70% 이상 DAU

## 📅 개발 일정 요약

| 주차 | 주요 작업 | 마일스톤 |
|------|----------|----------|
| 1주 | Creator 도메인, User-Subscription | 크리에이터 관리 API 완성 |
| 2주 | Creator-Application | 크리에이터 신청 시스템 완성 |
| 3주 | Content 도메인 | 콘텐츠 피드 API 완성 |
| 4주 | User-Interaction | 사용자 상호작용 시스템 완성 |
| 5주 | YouTube/Twitter API | 외부 API 통합 완성 |
| 6주 | 실시간 알림 시스템 | WebSocket 알림 시스템 완성 |
| 7주 | 기본 추천 시스템 | 개인화 추천 API 완성 |
| 8주 | 관리자 시스템, QA | **MVP 릴리즈** |

**총 개발 기간: 8주 (2개월)**

## 🚀 현재 진행 상황

### ✅ **완료된 작업**
1. **API URL v1 제거** - 모든 엔드포인트에서 `/api/v1/` → `/api/`로 변경
2. **TypeORM 관계 데코레이터 제거** - 외래키 기반 설계로 전환
3. **Creator 도메인 설계 완료** - 엔티티 구조, 서비스 패턴, API 설계
4. **CreatorConsent 분리** - 데이터 동의 관리를 별도 엔티티로 분리
5. **CLAUDE.md 업데이트** - 개선된 엔티티 구조 반영

### 🎯 **다음 단계: Phase 1 시작**
- Creator 도메인의 실제 구현 시작
- CreatorEntity, CreatorService, CreatorController 구현
- krgeobuk 표준 패턴 적용
- 단위 테스트 작성

## 💡 개발 참고사항

### krgeobuk 표준 패턴 준수
- **서비스 클래스 구조**: PUBLIC METHODS / PRIVATE HELPER METHODS 분리
- **에러 처리 표준**: 도메인별 Exception 클래스 사용
- **로깅 시스템**: 구조화된 로그 메시지 형식
- **TCP 컨트롤러**: 표준 메시지 패턴 적용

### 코드 품질 관리
- **TypeScript 완전 활용**: any 타입 금지, 명시적 타입 지정
- **ESLint + Prettier**: 일관된 코드 스타일
- **테스트 커버리지**: 80% 이상 유지
- **성능 최적화**: 쿼리 최적화, 캐싱 전략 적용

---

*문서 작성일: 2025년 8월 2일*  
*버전: 1.0*  
*총 개발 기간: 8주 (Phase 1-6)*  
*목표: MVP 릴리즈*