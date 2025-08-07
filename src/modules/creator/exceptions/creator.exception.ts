import { 
  HttpException, 
  NotFoundException, 
  ConflictException, 
  InternalServerErrorException,
  BadRequestException 
} from '@nestjs/common';

export class CreatorException {
  // ==================== 조회 관련 (100-199) ====================
  
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

  static platformNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_103',
      message: '플랫폼 정보를 찾을 수 없습니다.',
    });
  }

  static platformFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_104',
      message: '플랫폼 정보 조회 중 오류가 발생했습니다.',
    });
  }

  static consentNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_105',
      message: '동의 정보를 찾을 수 없습니다.',
    });
  }

  static consentFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_106',
      message: '동의 정보 조회 중 오류가 발생했습니다.',
    });
  }

  static platformSyncNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_107',
      message: '플랫폼 동기화 정보를 찾을 수 없습니다.',
    });
  }

  static platformSyncFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_108',
      message: '플랫폼 동기화 정보 조회 중 오류가 발생했습니다.',
    });
  }

  // ==================== 생성/수정 관련 (200-299) ====================
  
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

  static platformAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_205',
      message: '해당 플랫폼은 이미 등록되어 있습니다.',
    });
  }

  static platformCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_206',
      message: '플랫폼 등록 중 오류가 발생했습니다.',
    });
  }

  static platformUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_207',
      message: '플랫폼 정보 수정 중 오류가 발생했습니다.',
    });
  }

  static consentCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_208',
      message: '동의 정보 생성 중 오류가 발생했습니다.',
    });
  }

  static consentUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_209',
      message: '동의 정보 수정 중 오류가 발생했습니다.',
    });
  }

  static platformSyncCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_210',
      message: '플랫폼 동기화 정보 생성 중 오류가 발생했습니다.',
    });
  }

  static platformSyncUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_211',
      message: '플랫폼 동기화 정보 수정 중 오류가 발생했습니다.',
    });
  }

  static platformDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_212',
      message: '플랫폼 삭제 중 오류가 발생했습니다.',
    });
  }

  // ==================== 비즈니스 로직 관련 (300-399) ====================
  
  static invalidCreatorData(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_301',
      message: '유효하지 않은 크리에이터 데이터입니다.',
    });
  }

  static invalidPlatformData(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_302',
      message: '유효하지 않은 플랫폼 데이터입니다.',
    });
  }

  static consentExpired(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_303',
      message: '동의가 만료되었습니다. 재동의가 필요합니다.',
    });
  }

  static insufficientPermissions(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_304',
      message: '해당 작업을 수행할 권한이 없습니다.',
    });
  }

  static platformSyncError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_305',
      message: '플랫폼 동기화 중 오류가 발생했습니다.',
    });
  }

  // ==================== 통계 관련 (400-499) ====================

  static statisticsNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_401',
      message: '크리에이터 통계 정보를 찾을 수 없습니다.',
    });
  }

  static statisticsFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_402',
      message: '크리에이터 통계 조회 중 오류가 발생했습니다.',
    });
  }

  static statisticsUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_403',
      message: '크리에이터 통계 업데이트 중 오류가 발생했습니다.',
    });
  }
}