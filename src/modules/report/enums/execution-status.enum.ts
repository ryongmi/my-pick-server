/**
 * 조치 실행 상태 Enum
 * 
 * 신고 조치의 실행 상태를 정의합니다.
 * @author Claude Code
 */

export enum ExecutionStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  FAILED = 'failed',
}