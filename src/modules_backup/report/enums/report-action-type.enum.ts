/**
 * 신고 조치 타입 Enum
 * 
 * 신고 처리 시 취할 수 있는 조치 유형을 정의합니다.
 * @author Claude Code
 */

export enum ReportActionType {
  WARNING = 'warning',
  SUSPENSION = 'suspension',
  BAN = 'ban',
  CONTENT_REMOVAL = 'content_removal',
  NONE = 'none',
}