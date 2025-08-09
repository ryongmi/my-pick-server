import {
  HttpException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

export class PlatformApplicationException {
  // 조회 관련 (100-199)
  static applicationNotFound(): HttpException {
    return new NotFoundException({
      code: 'PLATFORM_APPLICATION_101',
      message: '플랫폼 신청을 찾을 수 없습니다.',
    });
  }

  static applicationFetchError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_102',
      message: '플랫폼 신청 조회 중 오류가 발생했습니다.',
    });
  }

  // 생성/수정 관련 (200-299)
  static applicationAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'PLATFORM_APPLICATION_201',
      message: '이미 해당 플랫폼에 대한 신청이 존재합니다.',
    });
  }

  static applicationCreateError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_202',
      message: '플랫폼 신청 생성 중 오류가 발생했습니다.',
    });
  }

  static applicationUpdateError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_203',
      message: '플랫폼 신청 수정 중 오류가 발생했습니다.',
    });
  }

  static applicationDeleteError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_204',
      message: '플랫폼 신청 삭제 중 오류가 발생했습니다.',
    });
  }

  // 권한 관련 (300-399)
  static notApplicationOwner(): HttpException {
    return new ForbiddenException({
      code: 'PLATFORM_APPLICATION_301',
      message: '해당 플랫폼 신청에 대한 권한이 없습니다.',
    });
  }

  static cannotModifyReviewedApplication(): HttpException {
    return new BadRequestException({
      code: 'PLATFORM_APPLICATION_302',
      message: '이미 검토된 신청은 수정할 수 없습니다.',
    });
  }

  static cannotCancelReviewedApplication(): HttpException {
    return new BadRequestException({
      code: 'PLATFORM_APPLICATION_303',
      message: '이미 검토된 신청은 취소할 수 없습니다.',
    });
  }

  // 검토 관련 (400-499)
  static applicationAlreadyReviewed(): HttpException {
    return new BadRequestException({
      code: 'PLATFORM_APPLICATION_401',
      message: '이미 검토된 신청입니다.',
    });
  }

  static cannotReviewOwnApplication(): HttpException {
    return new ForbiddenException({
      code: 'PLATFORM_APPLICATION_402',
      message: '자신의 신청은 검토할 수 없습니다.',
    });
  }

  static applicationReviewError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_403',
      message: '플랫폼 신청 검토 중 오류가 발생했습니다.',
    });
  }

  // 플랫폼 생성 관련 (500-599)
  static platformCreationError(): HttpException {
    return new InternalServerErrorException({
      code: 'PLATFORM_APPLICATION_501',
      message: '승인된 신청으로부터 플랫폼 생성 중 오류가 발생했습니다.',
    });
  }

  static invalidPlatformData(): HttpException {
    return new BadRequestException({
      code: 'PLATFORM_APPLICATION_502',
      message: '유효하지 않은 플랫폼 데이터입니다.',
    });
  }

  static duplicatePlatform(): HttpException {
    return new ConflictException({
      code: 'PLATFORM_APPLICATION_503',
      message: '이미 등록된 플랫폼입니다.',
    });
  }

  // ==================== 거부 사유별 메시지 ====================

  static getRejectionReasonMessage(reason: string): string {
    const messages: Record<string, string> = {
      invalid_platform_info:
        '플랫폼 정보가 올바르지 않습니다. 정확한 채널 ID나 사용자명을 확인해주세요.',
      insufficient_verification: '인증 자료가 부족합니다. 더 명확한 소유권 증명을 제출해주세요.',
      duplicate_platform: '이미 등록된 플랫폼입니다. 중복 신청은 처리할 수 없습니다.',
      inappropriate_content:
        '부적절한 콘텐츠가 포함되어 있습니다. 커뮤니티 가이드라인을 확인해주세요.',
      low_activity: '플랫폼 활동이 부족합니다. 최근 3개월 이내 활발한 활동이 필요합니다.',
      technical_issues: '기술적 문제로 인해 플랫폼 연동이 불가능합니다.',
      fake_account: '가짜 계정으로 의심됩니다. 공식 계정임을 증명하는 자료를 제출해주세요.',
      policy_violation: '서비스 정책을 위반하는 내용이 발견되었습니다.',
      other: '기타 사유로 인해 승인이 어렵습니다. 자세한 내용은 코멘트를 확인해주세요.',
    };

    return messages[reason] || '알 수 없는 거부 사유입니다.';
  }

  static getMultipleRejectionMessage(reasons: string[]): string {
    if (reasons.length === 0) {
      return '거부 사유가 지정되지 않았습니다.';
    }

    if (reasons.length === 1) {
      return this.getRejectionReasonMessage(reasons[0]!);
    }

    const messages = reasons.map((reason) => `• ${this.getRejectionReasonMessage(reason)}`);
    return `다음과 같은 사유로 승인이 어렵습니다:\n${messages.join('\n')}`;
  }
}
