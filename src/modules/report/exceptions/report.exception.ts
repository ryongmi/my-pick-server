import {
  HttpException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

export class ReportException {
  // ==================== 조회 관련 (100-199) ====================

  static reportNotFound(): HttpException {
    return new NotFoundException({
      code: 'REPORT_101',
      message: '신고를 찾을 수 없습니다.',
    });
  }

  static reportFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_102',
      message: '신고 조회 중 오류가 발생했습니다.',
    });
  }

  static targetNotFound(): HttpException {
    return new NotFoundException({
      code: 'REPORT_103',
      message: '신고 대상을 찾을 수 없습니다.',
    });
  }

  // ==================== 생성/수정 관련 (200-299) ====================

  static duplicateReport(): HttpException {
    return new ConflictException({
      code: 'REPORT_201',
      message: '이미 동일한 대상에 대한 신고가 접수되어 있습니다.',
    });
  }

  static reportCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_202',
      message: '신고 접수 중 오류가 발생했습니다.',
    });
  }

  static reportUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_203',
      message: '신고 수정 중 오류가 발생했습니다.',
    });
  }

  static invalidReportData(): HttpException {
    return new BadRequestException({
      code: 'REPORT_204',
      message: '잘못된 신고 데이터입니다.',
    });
  }

  // ==================== 권한 관련 (300-399) ====================

  static reportAccessDenied(): HttpException {
    return new ForbiddenException({
      code: 'REPORT_301',
      message: '해당 신고에 접근할 권한이 없습니다.',
    });
  }

  static selfReportNotAllowed(): HttpException {
    return new BadRequestException({
      code: 'REPORT_302',
      message: '자기 자신을 신고할 수 없습니다.',
    });
  }

  static reviewPermissionRequired(): HttpException {
    return new ForbiddenException({
      code: 'REPORT_303',
      message: '신고 검토 권한이 필요합니다.',
    });
  }

  // ==================== 상태 관련 (400-499) ====================

  static invalidStatusTransition(): HttpException {
    return new BadRequestException({
      code: 'REPORT_401',
      message: '잘못된 상태 전환입니다.',
    });
  }

  static reportAlreadyReviewed(): HttpException {
    return new ConflictException({
      code: 'REPORT_402',
      message: '이미 검토가 완료된 신고입니다.',
    });
  }

  static cannotDeleteReviewedReport(): HttpException {
    return new BadRequestException({
      code: 'REPORT_403',
      message: '검토가 완료된 신고는 삭제할 수 없습니다.',
    });
  }

  // ==================== 일반 오류 (500-599) ====================

  static reportProcessingError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_501',
      message: '신고 처리 중 오류가 발생했습니다.',
    });
  }

  static statisticsGenerationError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_502',
      message: '신고 통계 생성 중 오류가 발생했습니다.',
    });
  }
}
