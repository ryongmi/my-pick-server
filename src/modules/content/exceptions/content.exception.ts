import { HttpException, NotFoundException } from '@nestjs/common';

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
}
