-- =====================================================
-- MyPick Server - User Interactions Table Migration
-- =====================================================
-- 사용자-콘텐츠 상호작용 테이블 생성
-- 북마크, 좋아요, 시청 기록, 평점 등을 저장
-- =====================================================

CREATE TABLE IF NOT EXISTS `user_interactions` (
  -- 복합 기본키
  `userId` CHAR(36) NOT NULL COMMENT '사용자 ID (auth-server User.id)',
  `contentId` CHAR(36) NOT NULL COMMENT '콘텐츠 ID (ContentEntity.id)',

  -- 상호작용 플래그
  `isBookmarked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '북마크 여부',
  `isLiked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '좋아요 여부',

  -- 시청 정보
  `watchedAt` DATETIME NULL DEFAULT NULL COMMENT '마지막 시청 시각',
  `watchDuration` INT NULL DEFAULT NULL COMMENT '시청 시간 (초 단위)',

  -- 평점
  `rating` DECIMAL(2, 1) NULL DEFAULT NULL COMMENT '평점 (1.0 ~ 5.0)',

  -- 타임스탬프
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',

  -- 복합 기본키 설정
  PRIMARY KEY (`userId`, `contentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자-콘텐츠 상호작용 테이블 (북마크, 좋아요, 시청기록, 평점)';

-- =====================================================
-- 인덱스 생성
-- =====================================================

-- 사용자별 상호작용 조회용
CREATE INDEX `IDX_user_interactions_userId`
ON `user_interactions` (`userId`);

-- 콘텐츠별 상호작용 조회용
CREATE INDEX `IDX_user_interactions_contentId`
ON `user_interactions` (`contentId`);

-- 사용자별 북마크 목록 조회용
CREATE INDEX `IDX_user_interactions_userId_isBookmarked`
ON `user_interactions` (`userId`, `isBookmarked`);

-- 사용자별 좋아요 목록 조회용
CREATE INDEX `IDX_user_interactions_userId_isLiked`
ON `user_interactions` (`userId`, `isLiked`);

-- 콘텐츠별 좋아요 카운트 조회용
CREATE INDEX `IDX_user_interactions_contentId_isLiked`
ON `user_interactions` (`contentId`, `isLiked`);

-- 복합 기본키에 대한 유니크 인덱스 (자동 생성되지만 명시적으로 표시)
-- CREATE UNIQUE INDEX `IDX_user_interactions_userId_contentId`
-- ON `user_interactions` (`userId`, `contentId`);

-- =====================================================
-- 마이그레이션 완료
-- =====================================================
