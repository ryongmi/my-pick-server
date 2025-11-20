import { HttpException, NotFoundException, ForbiddenException } from '@nestjs/common';

export class ContentException {
  /**
   * 콘텐츠를 찾을 수 없음
   */
  static contentNotFound(): HttpException {
    return new NotFoundException({
      code: 'CONTENT_101',
      message: '콘텐츠를 찾을 수 없습니다.',
    });
  }

  /**
   * 권한 없음 (Forbidden)
   */
  static forbidden(message?: string): HttpException {
    return new ForbiddenException({
      code: 'CONTENT_102',
      message: message || '해당 콘텐츠에 대한 권한이 없습니다.',
    });
  }
}
