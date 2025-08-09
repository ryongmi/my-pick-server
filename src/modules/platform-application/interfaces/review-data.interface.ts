import { RejectionReason } from '../enums/index.js';

export interface ReviewData {
  reasons?: RejectionReason[]; // 표준화된 거부 사유들 (다중 선택 가능)
  customReason?: string | undefined; // 기타 사유일 때의 상세 설명
  comment?: string | undefined; // 관리자 코멘트
  requirements?: string[] | undefined; // 추가 요구사항
  reason?: string | undefined; // 기존 호환성
}
