# My Pick Server 배포 가이드

## 배포 환경 설정

### 로컬 개발 환경
```bash
# 1. 공유 라이브러리 Verdaccio 레지스트리 시작
cd ../shared-lib
pnpm docker:up

# 2. 공유 라이브러리 빌드
pnpm build

# 3. my-pick-server 의존성 설치
cd ../my-pick-server
npm install

# 4. 환경 변수 설정
cp envs/.env.local envs/.env

# 5. 개발 서버 시작
npm run start:debug
```

### Docker 개발 환경
```bash
# 로컬 Docker 스택 시작
npm run docker:local:up

# 로그 확인
npm run logs

# 스택 중지
npm run docker:local:down
```

### 프로덕션 배포
```bash
# 1. 환경 변수 설정
# envs/.env.prod 파일에서 프로덕션 값들 설정

# 2. 프로덕션 빌드 및 배포
npm run docker:prod:up

# 3. 프로덕션 로그 확인
npm run logs:prod

# 4. 헬스체크
npm run health-check
```

## 서비스 포트 구성

### 개발 환경
- **my-pick-server**: 4000
- **MySQL**: 3310 (외부 접속)
- **Redis**: 6383 (외부 접속)
- **Debug 포트**: 9233

### 프로덕션 환경
- **my-pick-server**: 4000 (내부)
- **MySQL**: 3306 (내부)
- **Redis**: 6379 (내부)

## 환경 변수 설정

### 필수 환경 변수
```env
# 서버 설정
NODE_ENV=production
PORT=4000
APP_NAME=my-pick-server

# 데이터베이스
MYSQL_HOST=my-pick-mysql-prod
MYSQL_PORT=3306
MYSQL_USER=krgeobuk
MYSQL_PASSWORD=your_production_password
MYSQL_DATABASE=my-pick

# Redis
REDIS_HOST=my-pick-redis-prod
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 외부 API
YOUTUBE_API_KEY=your_youtube_api_key
TWITTER_BEARER_TOKEN=your_twitter_token

# 마이크로서비스 연동
AUTH_SERVICE_HOST=auth-server
AUTH_SERVICE_PORT=8000
AUTHZ_SERVICE_HOST=authz-server
AUTHZ_SERVICE_PORT=8100
```

## 배포 확인 사항

### 1. 빌드 상태
```bash
# TypeScript 컴파일 (테스트 제외)
npx tsc -p tsconfig.build.json

# 결과: 오류 없음 ✅
```

### 2. API 엔드포인트
- **헬스체크**: `GET /api/health`
- **크리에이터**: `GET /api/creators`
- **콘텐츠**: `GET /api/content`
- **관리자**: `GET /api/admin/dashboard`

### 3. 데이터베이스 마이그레이션
```bash
# TypeORM 자동 동기화 설정됨
# synchronize: true (개발용)
# synchronize: false (프로덕션용 - 수동 마이그레이션 필요)
```

## 모니터링

### Docker 로그 확인
```bash
# 개발 환경
docker logs my-pick-server -f

# 프로덕션 환경
docker logs my-pick-server-prod -f
```

### 헬스체크
```bash
curl http://localhost:4000/api/health
```

### API 문서
- **Swagger UI**: `http://localhost:4000/api/docs`

## 트러블슈팅

### 일반적인 문제들

1. **MySQL 연결 실패**
   - 환경 변수 확인: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_PASSWORD`
   - Docker 네트워크 확인: `my-pick-network`

2. **Redis 연결 실패**
   - 환경 변수 확인: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
   - Redis 컨테이너 상태 확인

3. **외부 API 연동 실패**
   - API 키 확인: `YOUTUBE_API_KEY`, `TWITTER_BEARER_TOKEN`
   - 쿼터 제한 확인: `/api/admin/external-api/quota`

4. **권한 오류**
   - JWT 토큰 확인
   - auth-server, authz-server 연결 상태 확인