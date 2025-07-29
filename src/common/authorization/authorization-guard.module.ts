import { Global, Module } from '@nestjs/common';

import { AuthorizationModule, AuthorizationService } from '@modules/authorization/index.js';

@Global() // ✅ 글로벌 설정
@Module({
  imports: [AuthorizationModule],
  providers: [{ provide: 'AUTHORIZATION_SERVICE', useExisting: AuthorizationService }],
  exports: ['AUTHORIZATION_SERVICE'], // 다른 모듈에서 사용 가능하도록 export
})
export class AuthorizationGuardModule {}
