import { Controller, Get } from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
} from '@krgeobuk/swagger/decorators';

@SwaggerApiTags({ tags: ['health'] })
@Controller('health')
export class HealthController {
  @Get()
  @SwaggerApiOperation({
    summary: '서버 상태 확인',
    description: '서버와 데이터베이스 연결 상태를 확인합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '서버가 정상적으로 동작 중입니다.',
  })
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
  }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'my-pick-server',
      version: '0.0.1',
    };
  }
}