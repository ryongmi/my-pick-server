import {
  HttpException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

export class CreatorApplicationException {
  // 조회 관련 (100-199)
  static applicationNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_APPLICATION_101',
      message: '크리에이터 신청을 찾을 수 없습니다.',
    });
  }

  static applicationFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_APPLICATION_102',
      message: '크리에이터 신청 조회 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static activeApplicationExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_APPLICATION_201',
      message: '이미 처리 중인 크리에이터 신청이 있습니다.',
    });
  }

  static applicationCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_APPLICATION_202',
      message: '크리에이터 신청 생성 중 오류가 발생했습니다.',
    });
  }

  static applicationReviewError(): HttpException {
    return new InternalServerErrorException({
      code: 'CREATOR_APPLICATION_203',
      message: '크리에이터 신청 검토 중 오류가 발생했습니다.',
    });
  }

  // 권한 관련 (300-399)
  static notApplicationOwner(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_APPLICATION_301',
      message: '신청자만 조회할 수 있습니다.',
    });
  }

  static cannotReviewOwnApplication(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_APPLICATION_302',
      message: '본인의 신청은 검토할 수 없습니다.',
    });
  }

  // 상태 관련 (400-499)
  static applicationAlreadyReviewed(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_401',
      message: '이미 검토가 완료된 신청입니다.',
    });
  }

  static invalidApplicationStatus(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_402',
      message: '잘못된 신청 상태입니다.',
    });
  }

  static invalidApplicationData(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_403',
      message: '잘못된 신청 데이터입니다.',
    });
  }
}
