import { HttpException, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

export class CreatorApplicationException {
  // ==================== Retrieval Errors (100-199) ====================

  static applicationNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_APPLICATION_101',
      message: '크리에이터 신청을 찾을 수 없습니다.',
    });
  }

  // ==================== Creation/Update Errors (200-299) ====================

  static activeApplicationExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_APPLICATION_201',
      message: '이미 검토 대기 중인 신청이 있습니다.',
    });
  }

  static channelNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_APPLICATION_202',
      message: '채널을 찾을 수 없습니다. 채널 ID를 확인해주세요.',
    });
  }

  static channelAlreadyRegistered(): HttpException {
    return new ConflictException({
      code: 'CREATOR_APPLICATION_203',
      message: '이미 등록된 채널입니다.',
    });
  }

  static platformNotSupported(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_204',
      message: '지원하지 않는 플랫폼입니다.',
    });
  }

  static applicationCreateError(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_205',
      message: '신청 생성 중 오류가 발생했습니다.',
    });
  }

  // ==================== Authorization Errors (300-399) ====================

  static notApplicationOwner(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_APPLICATION_301',
      message: '본인의 신청만 조회할 수 있습니다.',
    });
  }

  // ==================== Status Errors (400-499) ====================

  static applicationAlreadyReviewed(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_401',
      message: '이미 검토가 완료된 신청입니다.',
    });
  }

  static rejectionReasonRequired(): HttpException {
    return new BadRequestException({
      code: 'CREATOR_APPLICATION_402',
      message: '거부 사유는 필수입니다.',
    });
  }
}
