import {
  HttpException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

export class CreatorException {
  // 조회 관련 (100-199)
  static creatorNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_101',
      message: '크리에이터를 찾을 수 없습니다.',
    });
  }

  static creatorFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_102',
      message: '크리에이터 조회 중 오류가 발생했습니다.',
    });
  }

  static creatorSearchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_103',
      message: '크리에이터 검색 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static creatorAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_201',
      message: '이미 존재하는 크리에이터입니다.',
    });
  }

  static creatorCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_202',
      message: '크리에이터 생성 중 오류가 발생했습니다.',
    });
  }

  static creatorUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_203',
      message: '크리에이터 수정 중 오류가 발생했습니다.',
    });
  }

  static creatorDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_204',
      message: '크리에이터 삭제 중 오류가 발생했습니다.',
    });
  }

  // 플랫폼 관련 (250-299)
  static platformFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_250',
      message: '플랫폼 정보 조회 중 오류가 발생했습니다.',
    });
  }

  // 구독 관련 (300-399)
  static subscriptionAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_301',
      message: '이미 구독중인 크리에이터입니다.',
    });
  }

  static subscriptionNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_302',
      message: '구독 정보를 찾을 수 없습니다.',
    });
  }

  static subscriptionError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_303',
      message: '구독 처리 중 오류가 발생했습니다.',
    });
  }

  // 플랫폼 관련 (500-599)
  static platformNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_501',
      message: '플랫폼을 찾을 수 없습니다.',
    });
  }

  static platformAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_502',
      message: '이미 등록된 플랫폼입니다.',
    });
  }

  static platformCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_503',
      message: '플랫폼 생성 중 오류가 발생했습니다.',
    });
  }

  static platformUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_504',
      message: '플랫폼 수정 중 오류가 발생했습니다.',
    });
  }

  static platformDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_505',
      message: '플랫폼 삭제 중 오류가 발생했습니다.',
    });
  }

  static creatorPlatformNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_508',
      message: '크리에이터 플랫폼을 찾을 수 없습니다.',
    });
  }

  static creatorPlatformAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_509',
      message: '이미 등록된 크리에이터 플랫폼입니다.',
    });
  }

  static creatorPlatformCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_510',
      message: '크리에이터 플랫폼 생성 중 오류가 발생했습니다.',
    });
  }

  static creatorPlatformUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_511',
      message: '크리에이터 플랫폼 수정 중 오류가 발생했습니다.',
    });
  }

  static creatorPlatformDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_512',
      message: '크리에이터 플랫폼 삭제 중 오류가 발생했습니다.',
    });
  }

  static platformSyncError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_506',
      message: '플랫폼 동기화 중 오류가 발생했습니다.',
    });
  }

  static cannotRemoveLastPlatform(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_507',
      message: '마지막 플랫폼은 삭제할 수 없습니다.',
    });
  }

  // 유효성 검증 관련 (400-499)
  static invalidCreatorData(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_401',
      message: '잘못된 크리에이터 데이터입니다.',
    });
  }

  static invalidPlatformData(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_402',
      message: '잘못된 플랫폼 데이터입니다.',
    });
  }

  static creatorAccessDenied(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_403',
      message: '크리에이터에 대한 접근 권한이 없습니다.',
    });
  }

  // 데이터 동의 관련 (600-699)
  static consentRequired(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_601',
      message: '데이터 수집에 대한 동의가 필요합니다.',
    });
  }

  static consentExpired(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_602',
      message: '데이터 수집 동의가 만료되었습니다.',
    });
  }

  static consentUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_603',
      message: '동의 상태 업데이트 중 오류가 발생했습니다.',
    });
  }

  static consentCheckError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_604',
      message: '동의 상태 확인 중 오류가 발생했습니다.',
    });
  }

  static consentNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_605',
      message: '동의를 찾을 수 없습니다.',
    });
  }

  static consentFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_606',
      message: '동의 조회 중 오류가 발생했습니다.',
    });
  }

  static consentCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_607',
      message: '동의 생성 중 오류가 발생했습니다.',
    });
  }
}