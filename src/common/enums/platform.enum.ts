export enum PlatformType {
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
}

export enum SyncStatus {
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled',
}

export enum VideoSyncStatus {
  NEVER_SYNCED = 'never_synced', // 승인 후 초기 동기화 대기
  INITIAL_SYNCING = 'initial_syncing', // 초기 동기화 진행중
  INCREMENTAL = 'incremental', // 증분 동기화 모드
  CONSENT_CHANGED = 'consent_changed', // 동의 변경으로 재동기화 필요

  // 추가된 상태값들
  IN_PROGRESS = 'in_progress', // 동기화 진행중
  COMPLETED = 'completed', // 동기화 완료
  FAILED = 'failed', // 동기화 실패
}
