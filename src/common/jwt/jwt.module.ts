import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtException } from '@krgeobuk/jwt/exception';

import { JwtConfig } from '@common/interfaces/index.js';

@Global() // ✅ 글로벌 설정
@Module({
  providers: [
    {
      provide: 'JWT_ACCESS_PUBLIC_KEY',
      useFactory: (configService: ConfigService): string => {
        const publicKey = configService.get<JwtConfig['accessPublicKey']>('jwt.accessPublicKey');
        if (!publicKey) throw JwtException.publicKeyMissing('access');
        return publicKey;
      },
      inject: [ConfigService],
    },
    // {
    //   provide: 'REFRESH_TOKEN',
    //   useClass: SomeRefreshTokenService,
    // },
  ],
  exports: ['JWT_ACCESS_PUBLIC_KEY'], // 다른 모듈에서 사용 가능하도록 export
})
export class JwtModule {}
