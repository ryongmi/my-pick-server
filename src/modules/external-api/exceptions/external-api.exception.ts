import {
  HttpException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ServiceUnavailableException,
  TooManyRequestsException,
} from '@nestjs/common';

export class ExternalApiException {
  // YouTube API 관련 (100-199)
  static youtubeApiError(): HttpException {
    return new ServiceUnavailableException({
      code: 'EXTERNAL_API_101',
      message: 'YouTube API 호출 중 오류가 발생했습니다.',
    });
  }

  static youtubeChannelNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_102',
      message: 'YouTube 채널을 찾을 수 없습니다.',
    });
  }

  static youtubeVideoNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_103',
      message: 'YouTube 비디오를 찾을 수 없습니다.',
    });
  }

  static youtubeRateLimitExceeded(): HttpException {
    return new TooManyRequestsException({
      code: 'EXTERNAL_API_104',
      message: 'YouTube API 요청 한도를 초과했습니다.',
    });
  }

  static youtubeQuotaExceeded(): HttpException {
    return new ServiceUnavailableException({
      code: 'EXTERNAL_API_105',
      message: 'YouTube API 할당량을 초과했습니다.',
    });
  }

  static youtubeApiValidationError(): HttpException {
    return new BadRequestException({
      code: 'EXTERNAL_API_106',
      message: 'YouTube API 응답 데이터 검증에 실패했습니다.',
    });
  }

  // Twitter API 관련 (200-299)
  static twitterApiError(): HttpException {
    return new ServiceUnavailableException({
      code: 'EXTERNAL_API_201',
      message: 'Twitter API 호출 중 오류가 발생했습니다.',
    });
  }

  static twitterUserNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_202',
      message: 'Twitter 사용자를 찾을 수 없습니다.',
    });
  }

  static twitterTweetNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_203',
      message: 'Twitter 게시물을 찾을 수 없습니다.',
    });
  }

  static twitterRateLimitExceeded(): HttpException {
    return new TooManyRequestsException({
      code: 'EXTERNAL_API_204',
      message: 'Twitter API 요청 한도를 초과했습니다.',
    });
  }

  static twitterUnauthorized(): HttpException {
    return new BadRequestException({
      code: 'EXTERNAL_API_205',
      message: 'Twitter API 인증에 실패했습니다.',
    });
  }

  // 일반 외부 API 관련 (300-399)
  static apiConfigurationError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_301',
      message: '외부 API 설정이 올바르지 않습니다.',
    });
  }

  static networkError(): HttpException {
    return new ServiceUnavailableException({
      code: 'EXTERNAL_API_302',
      message: '외부 API 서버에 연결할 수 없습니다.',
    });
  }

  static invalidApiResponse(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_303',
      message: '외부 API에서 유효하지 않은 응답을 받았습니다.',
    });
  }

  // 데이터 동기화 관련 (400-499)
  static dataSyncError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_401',
      message: '데이터 동기화 중 오류가 발생했습니다.',
    });
  }

  static platformNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_402',
      message: '플랫폼 정보를 찾을 수 없습니다.',
    });
  }

  static userNotFound(): HttpException {
    return new NotFoundException({
      code: 'EXTERNAL_API_403',
      message: '사용자 정보를 찾을 수 없습니다.',
    });
  }

  static syncInProgress(): HttpException {
    return new BadRequestException({
      code: 'EXTERNAL_API_404',
      message: '이미 동기화가 진행 중입니다.',
    });
  }

  static contentCreationError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_405',
      message: '외부 콘텐츠 생성 중 오류가 발생했습니다.',
    });
  }

  // 스케줄러 관련 (500-599)
  static schedulerError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_501',
      message: '스케줄러 실행 중 오류가 발생했습니다.',
    });
  }

  static jobExecutionError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_502',
      message: '예약된 작업 실행 중 오류가 발생했습니다.',
    });
  }

  // 쿼터 관리 관련 (600-699)
  static quotaExceeded(): HttpException {
    return new TooManyRequestsException({
      code: 'EXTERNAL_API_601',
      message: 'API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.',
    });
  }

  static quotaMonitorError(): HttpException {
    return new InternalServerErrorException({
      code: 'EXTERNAL_API_602',
      message: '쿼터 모니터링 중 오류가 발생했습니다.',
    });
  }
}