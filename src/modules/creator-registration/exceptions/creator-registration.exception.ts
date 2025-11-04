import { HttpException, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

export class CreatorRegistrationException {
  // ==================== Retrieval Errors (100-199) ====================

  static registrationNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_REGISTRATION_101',
      message: '크리에이터 신청을 찾을 수 없습니다.',
    });
  }

  // ==================== Creation/Update Errors (200-299) ====================

  static activeRegistrationExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_REGISTRATION_201',
      message: '이미 검토 대기 중인 신청이 있습니다.',
    });
  }

  static channelNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_REGISTRATION_202',
      message: '채널을 찾을 수 없습니다. 채널 ID를 확인해주세요.',
    });
  }

  static channelAlreadyRegistered(): HttpException {
    return new ConflictException({
      code: 'CREATOR_REGISTRATION_203',
      message: '이미 등록된 채널입니다.',
    });
  }

  static platformNotSupported(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_REGISTRATION_204',
      message: '지원하지 않는 플랫폼입니다.',
    });
  }

  static registrationCreateError(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_REGISTRATION_205',
      message: '신청 생성 중 오류가 발생했습니다.',
    });
  }

  // ==================== Authorization Errors (300-399) ====================

  static notRegistrationOwner(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_REGISTRATION_301',
      message: '본인의 신청만 조회할 수 있습니다.',
    });
  }

  // ==================== Status Errors (400-499) ====================

  static registrationAlreadyReviewed(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_REGISTRATION_401',
      message: '이미 검토가 완료된 신청입니다.',
    });
  }

  static rejectionReasonRequired(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_REGISTRATION_402',
      message: '거부 사유는 필수입니다.',
    });
  }
}
