import {
  HttpException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

export class CreatorException {
  /**
   * 크리에이터를 찾을 수 없음
   */
  static creatorNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_101',
      message: '크리에이터를 찾을 수 없습니다.',
    });
  }

  /**
   * 크리에이터가 이미 존재함
   */
  static creatorAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_102',
      message: '이미 존재하는 크리에이터입니다.',
    });
  }

  /**
   * 크리에이터의 소유자가 아님
   */
  static notCreatorOwner(): HttpException {
    return new ForbiddenException({
      code: 'CREATOR_105',
      message: '이 크리에이터에 대한 권한이 없습니다.',
    });
  }

  /**
   * 플랫폼을 찾을 수 없음
   */
  static platformNotFound(): HttpException {
    return new NotFoundException({
      code: 'CREATOR_103',
      message: '플랫폼을 찾을 수 없습니다.',
    });
  }

  /**
   * 플랫폼이 이미 존재함
   */
  static platformAlreadyExists(): HttpException {
    return new ConflictException({
      code: 'CREATOR_104',
      message: '이미 등록된 플랫폼입니다.',
    });
  }
}
