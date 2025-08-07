export enum ReportReason {
  // 콘텐츠 관련
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  COPYRIGHT_VIOLATION = 'copyright_violation',
  SPAM = 'spam',
  HATE_SPEECH = 'hate_speech',
  MISINFORMATION = 'misinformation',
  VIOLENCE = 'violence',
  ADULT_CONTENT = 'adult_content',
  
  // 사용자/크리에이터 관련
  HARASSMENT = 'harassment',
  IMPERSONATION = 'impersonation',
  FAKE_ACCOUNT = 'fake_account',
  SCAM = 'scam',
  PRIVACY_VIOLATION = 'privacy_violation',
  
  // 기타
  OTHER = 'other',
}