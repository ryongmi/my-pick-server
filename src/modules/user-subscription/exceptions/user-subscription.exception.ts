import { HttpException, ConflictException, NotFoundException } from '@nestjs/common';

export class UserSubscriptionException {
  /**
   * 이미 구독 중인 크리에이터
   */
  static alreadySubscribed(): HttpException {
    return new ConflictException({
      code: 'USER_SUBSCRIPTION_101',
      message: '이미 구독 중인 크리에이터입니다.',
    });
  }

  /**
   * 구독하지 않은 크리에이터
   */
  static notSubscribed(): HttpException {
    return new NotFoundException({
      code: 'USER_SUBSCRIPTION_102',
      message: '구독하지 않은 크리에이터입니다.',
    });
  }

  /**
   * 자신이 소유한 크리에이터를 구독할 수 없음
   */
  static cannotSubscribeSelf(): HttpException {
    return new ConflictException({
      code: 'USER_SUBSCRIPTION_103',
      message: '본인이 소유한 크리에이터는 구독할 수 없습니다.',
    });
  }
}
