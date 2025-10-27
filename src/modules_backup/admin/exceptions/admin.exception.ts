import {
  HttpException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

export class AdminException {
  // 권한 관련 (100-199)
  static insufficientPermissions(): HttpException {
    return new ForbiddenException({
      code: 'ADMIN_101',
      message: '관리자 권한이 필요합니다.',
    });
  }

  static invalidAdminAction(): HttpException {
    return new ForbiddenException({
      code: 'ADMIN_102',
      message: '유효하지 않은 관리자 작업입니다.',
    });
  }

  // 데이터 조회 관련 (200-299)
  static dashboardDataFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_201',
      message: '대시보드 데이터 조회 중 오류가 발생했습니다.',
    });
  }

  static userDataFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_202',
      message: '사용자 데이터 조회 중 오류가 발생했습니다.',
    });
  }

  static userNotFound(): HttpException {
    return new NotFoundException({
      code: 'ADMIN_204',
      message: '사용자를 찾을 수 없습니다.',
    });
  }

  static contentDataFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_203',
      message: '콘텐츠 데이터 조회 중 오류가 발생했습니다.',
    });
  }

  // 상태 변경 관련 (300-399)
  static userStatusUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_301',
      message: '사용자 상태 변경 중 오류가 발생했습니다.',
    });
  }

  static contentStatusUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_302',
      message: '콘텐츠 상태 변경 중 오류가 발생했습니다.',
    });
  }

  static invalidStatusTransition(): HttpException {
    return new BadRequestException({
      code: 'ADMIN_303',
      message: '유효하지 않은 상태 변경입니다.',
    });
  }

  // 모더레이션 관련 (400-499)
  static moderationActionError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_401',
      message: '모더레이션 작업 중 오류가 발생했습니다.',
    });
  }

  static selfModerationNotAllowed(): HttpException {
    return new BadRequestException({
      code: 'ADMIN_402',
      message: '자신에 대한 모더레이션 작업은 수행할 수 없습니다.',
    });
  }

  static duplicateModerationAction(): HttpException {
    return new BadRequestException({
      code: 'ADMIN_403',
      message: '이미 동일한 모더레이션 작업이 수행되었습니다.',
    });
  }

  // 시스템 관련 (500-599)
  static systemHealthCheckError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_501',
      message: '시스템 상태 확인 중 오류가 발생했습니다.',
    });
  }

  static statisticsGenerationError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_502',
      message: '통계 생성 중 오류가 발생했습니다.',
    });
  }

  // 콘텐츠 관련 (600-699)
  static contentDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'ADMIN_601',
      message: '콘텐츠 삭제 중 오류가 발생했습니다.',
    });
  }
}
