import {
  HttpException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

export class UserInteractionException {
  // 조회 관련 (100-199)
  static interactionNotFound(): HttpException {
    return new NotFoundException({
      code: 'USER_INTERACTION_101',
      message: '상호작용 정보를 찾을 수 없습니다.',
    });
  }

  static interactionFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_INTERACTION_102',
      message: '상호작용 정보 조회 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static bookmarkAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'USER_INTERACTION_201',
      message: '이미 북마크한 콘텐츠입니다.',
    });
  }

  static likeAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'USER_INTERACTION_202',
      message: '이미 좋아요한 콘텐츠입니다.',
    });
  }

  static interactionCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_INTERACTION_203',
      message: '상호작용 생성 중 오류가 발생했습니다.',
    });
  }

  static interactionUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_INTERACTION_204',
      message: '상호작용 수정 중 오류가 발생했습니다.',
    });
  }

  static interactionDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'USER_INTERACTION_205',
      message: '상호작용 삭제 중 오류가 발생했습니다.',
    });
  }

  // 유효성 검증 관련 (400-499)
  static invalidUserId(): HttpException {
    return new BadRequestException({
      code: 'USER_INTERACTION_401',
      message: '잘못된 사용자 ID입니다.',
    });
  }

  static invalidContentId(): HttpException {
    return new BadRequestException({
      code: 'USER_INTERACTION_402',
      message: '잘못된 콘텐츠 ID입니다.',
    });
  }

  static invalidRating(): HttpException {
    return new BadRequestException({
      code: 'USER_INTERACTION_403',
      message: '잘못된 평점입니다. (1-5 사이의 값)',
    });
  }

  static invalidWatchDuration(): HttpException {
    return new BadRequestException({
      code: 'USER_INTERACTION_404',
      message: '잘못된 시청 시간입니다.',
    });
  }
}