# Requirements JSON → Entity 마이그레이션 가이드

## 📋 마이그레이션 개요

`CreatorApplicationReviewEntity`의 `requirements` JSON 컬럼을 `CreatorApplicationRequirementEntity`로 분리

## 🔄 마이그레이션 단계

### 1단계: 새 테이블 생성
```sql
-- TypeORM이 자동 생성할 DDL
CREATE TABLE creator_application_requirements (
  id VARCHAR(36) PRIMARY KEY,
  reviewId VARCHAR(36) NOT NULL,
  requirement TEXT NOT NULL,
  category ENUM(...) NOT NULL,
  status ENUM(...) DEFAULT 'pending',
  isCompleted BOOLEAN DEFAULT FALSE,
  priority TINYINT DEFAULT 1,
  estimatedDays INT NULL,
  completedAt DATETIME NULL,
  description TEXT NULL,
  relatedUrl VARCHAR(255) NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2단계: 기존 JSON 데이터 이관
```javascript
// 마이그레이션 스크립트 예시 (실제 구현 시 작성)
async function migrateRequirements() {
  const reviews = await queryRunner.query(`
    SELECT id, requirements 
    FROM creator_application_reviews 
    WHERE requirements IS NOT NULL
  `);

  for (const review of reviews) {
    const requirements = JSON.parse(review.requirements);
    
    for (let i = 0; i < requirements.length; i++) {
      await queryRunner.query(`
        INSERT INTO creator_application_requirements 
        (id, reviewId, requirement, category, priority, createdAt, updatedAt)
        VALUES (UUID(), ?, ?, 'other', ?, NOW(), NOW())
      `, [review.id, requirements[i], i + 1]);
    }
  }
}
```

### 3단계: JSON 컬럼 제거
```sql
ALTER TABLE creator_application_reviews 
DROP COLUMN requirements;
```

## 🎯 마이그레이션 후 효과

### 성능 향상
- **개별 요구사항 검색**: `WHERE requirement LIKE '%문서%'`
- **상태별 필터링**: `WHERE status = 'completed'`
- **우선순위 정렬**: `ORDER BY priority ASC`

### 기능 확장
- **진행 상태 추적**: pending → in_progress → completed
- **카테고리별 관리**: 문서, 기술요구사항, 법적 준수 등
- **완료 시간 추적**: completedAt 필드

### 쿼리 예시
```sql
-- 특정 검토의 미완료 요구사항 조회
SELECT * FROM creator_application_requirements 
WHERE reviewId = ? AND isCompleted = FALSE 
ORDER BY priority ASC;

-- 카테고리별 요구사항 통계
SELECT category, COUNT(*) as total, 
       SUM(isCompleted) as completed
FROM creator_application_requirements 
GROUP BY category;
```

## ⚠️ 주의사항

1. **데이터 백업**: 마이그레이션 전 반드시 백업
2. **점진적 적용**: 개발 → 스테이징 → 프로덕션 순서
3. **롤백 준비**: 실패 시 복구 방안 준비
4. **성능 테스트**: 마이그레이션 후 쿼리 성능 검증

## 📝 서비스 레이어 변경점

기존:
```typescript
// JSON 배열 전체 교체
review.requirements = ['새 요구사항1', '새 요구사항2'];
```

변경 후:
```typescript
// 개별 요구사항 관리
await requirementService.addRequirement(reviewId, {
  requirement: '새 요구사항',
  category: RequirementCategory.DOCUMENTATION,
  priority: 1
});
```