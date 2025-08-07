import {
  HttpException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

export class ContentException {
  // 조회 관련 (100-199)
  static contentNotFound(): HttpException {
    return new NotFoundException({
      code: 'CONTENT_101',
      message: '콘텐츠를 찾을 수 없습니다.',
    });
  }

  static contentFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_102',
      message: '콘텐츠 조회 중 오류가 발생했습니다.',
    });
  }

  static contentSearchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_103',
      message: '콘텐츠 검색 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static contentAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CONTENT_201',
      message: '이미 존재하는 콘텐츠입니다.',
    });
  }

  static contentCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_202',
      message: '콘텐츠 생성 중 오류가 발생했습니다.',
    });
  }

  static contentUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_203',
      message: '콘텐츠 수정 중 오류가 발생했습니다.',
    });
  }

  static contentDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_204',
      message: '콘텐츠 삭제 중 오류가 발생했습니다.',
    });
  }

  static statisticsUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_205',
      message: '콘텐츠 통계 업데이트 중 오류가 발생했습니다.',
    });
  }

  static contentCleanupError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_206',
      message: '만료된 콘텐츠 정리 중 오류가 발생했습니다.',
    });
  }

  // 상호작용 관련 (300-399)
  static interactionAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CONTENT_301',
      message: '이미 상호작용한 콘텐츠입니다.',
    });
  }

  static interactionNotFound(): HttpException {
    return new NotFoundException({
      code: 'CONTENT_302',
      message: '상호작용 정보를 찾을 수 없습니다.',
    });
  }

  static interactionError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_303',
      message: '콘텐츠 상호작용 처리 중 오류가 발생했습니다.',
    });
  }

  // 유효성 검증 관련 (400-499)
  static invalidContentData(): HttpException {
    return new BadRequestException({
      code: 'CONTENT_401',
      message: '잘못된 콘텐츠 데이터입니다.',
    });
  }

  static invalidContentType(): HttpException {
    return new BadRequestException({
      code: 'CONTENT_402',
      message: '지원하지 않는 콘텐츠 타입입니다.',
    });
  }

  static invalidPlatform(): HttpException {
    return new BadRequestException({
      code: 'CONTENT_403',
      message: '지원하지 않는 플랫폼입니다.',
    });
  }

  static invalidRating(): HttpException {
    return new BadRequestException({
      code: 'CONTENT_404',
      message: '잘못된 평점입니다. (1-5 사이의 값)',
    });
  }

  // ==================== 통계 관련 (500-599) ====================

  static contentStatisticsFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_501',
      message: '콘텐츠 통계 조회 중 오류가 발생했습니다.',
    });
  }

  // ==================== 카테고리 관련 (600-699) ====================

  static contentCategoryUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_601',
      message: '콘텐츠 카테고리 업데이트 중 오류가 발생했습니다.',
    });
  }

  static contentCategoryDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_602',
      message: '콘텐츠 카테고리 삭제 중 오류가 발생했습니다.',
    });
  }

  // ==================== 태그 관련 (700-799) ====================

  static contentTagUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_701',
      message: '콘텐츠 태그 업데이트 중 오류가 발생했습니다.',
    });
  }

  static contentTagDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_702',
      message: '콘텐츠 태그 삭제 중 오류가 발생했습니다.',
    });
  }

  // ==================== 상호작용 관련 (800-899) ====================

  static contentInteractionCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_801',
      message: '콘텐츠 상호작용 생성 중 오류가 발생했습니다.',
    });
  }

  static contentInteractionUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_802',
      message: '콘텐츠 상호작용 업데이트 중 오류가 발생했습니다.',
    });
  }

  static contentInteractionDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CONTENT_803',
      message: '콘텐츠 상호작용 삭제 중 오류가 발생했습니다.',
    });
  }
}