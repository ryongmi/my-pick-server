import {
  HttpException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

export class UserSubscriptionException {
  // 조회 관련 (100-199)
  static subscriptionNotFound(): HttpException {
    return new NotFoundException({
      code: 'USER_SUBSCRIPTION_101',
      message: '구독 정보를 찾을 수 없습니다.',
    });
  }

  static subscriptionFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_SUBSCRIPTION_102',
      message: '구독 정보 조회 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static subscriptionAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'USER_SUBSCRIPTION_201',
      message: '이미 구독중인 크리에이터입니다.',
    });
  }

  static subscriptionCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_SUBSCRIPTION_202',
      message: '구독 처리 중 오류가 발생했습니다.',
    });
  }

  static subscriptionDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_SUBSCRIPTION_203',
      message: '구독 해제 중 오류가 발생했습니다.',
    });
  }

  // 유효성 검증 관련 (400-499)
  static invalidUserId(): HttpException {
    return new BadRequestException({
      code: 'USER_SUBSCRIPTION_401',
      message: '잘못된 사용자 ID입니다.',
    });
  }

  static invalidCreatorId(): HttpException {
    return new BadRequestException({
      code: 'USER_SUBSCRIPTION_402',
      message: '잘못된 크리에이터 ID입니다.',
    });
  }
}