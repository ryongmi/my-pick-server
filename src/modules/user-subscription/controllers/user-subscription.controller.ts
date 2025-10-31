import { Controller } from '@nestjs/common';

/**
 * 관리자용 사용자 구독 관리 컨트롤러 (향후 확장 예정)
 * 관리자가 다른 사용자의 구독 정보를 관리할 때 사용
 *
 * Note: 일반 사용자는 SubscriptionController를 사용하세요
 */
@Controller('users/:userId/subscriptions')
export class UserSubscriptionController {
  // 현재는 비어있음 - 관리자 기능 추가 시 구현 예정
}
