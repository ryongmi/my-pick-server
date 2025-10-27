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

  // ==================== 증거 관련 (600-649) ====================

  static evidenceNotFound(): HttpException {
    return new NotFoundException({
      code: 'REPORT_601',
      message: '신고 증거를 찾을 수 없습니다.',
    });
  }

  static evidenceAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'REPORT_602',
      message: '해당 신고에 대한 증거가 이미 존재합니다.',
    });
  }

  static evidenceCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_603',
      message: '증거 생성 중 오류가 발생했습니다.',
    });
  }

  static evidenceUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_604',
      message: '증거 수정 중 오류가 발생했습니다.',
    });
  }

  static evidenceDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_605',
      message: '증거 삭제 중 오류가 발생했습니다.',
    });
  }

  // ==================== 조치 관련 (650-699) ====================

  static actionNotFound(): HttpException {
    return new NotFoundException({
      code: 'REPORT_651',
      message: '신고 조치를 찾을 수 없습니다.',
    });
  }

  static actionCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_652',
      message: '조치 생성 중 오류가 발생했습니다.',
    });
  }

  static actionUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_653',
      message: '조치 수정 중 오류가 발생했습니다.',
    });
  }

  static actionDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_654',
      message: '조치 삭제 중 오류가 발생했습니다.',
    });
  }

  // ==================== 검토 관련 (700-749) ====================

  static reviewNotFound(): HttpException {
    return new NotFoundException({
      code: 'REPORT_701',
      message: '신고 검토 데이터를 찾을 수 없습니다.',
    });
  }

  static reviewAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'REPORT_702',
      message: '해당 신고에 대한 검토가 이미 존재합니다.',
    });
  }

  static reviewCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_703',
      message: '검토 데이터 생성 중 오류가 발생했습니다.',
    });
  }

  static reviewUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_704',
      message: '검토 데이터 수정 중 오류가 발생했습니다.',
    });
  }

  static reviewDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'REPORT_705',
      message: '검토 데이터 삭제 중 오류가 발생했습니다.',
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
