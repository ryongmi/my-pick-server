import { Global, Module } from '@nestjs/common';
import { ClientOptions, ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { ClientConfig } from '@common/interfaces/config.interfaces.js';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientOptions => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<ClientConfig['authServiceHost']>('authServiceHost')!,
            port: configService.get<ClientConfig['authServicePort']>('authServicePort')!,
          },
        }),
      },
      {
        name: 'AUTHZ_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientOptions => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<ClientConfig['authzServiceHost']>('authzServiceHost')!,
            port: configService.get<ClientConfig['authzServicePort']>('authzServicePort')!,
          },
        }),
      },
      {
        name: 'PORTAL_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientOptions => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<ClientConfig['portalServiceHost']>('portalServiceHost')!,
            port: configService.get<ClientConfig['portalServicePort']>('portalServicePort')!,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class SharedClientsModule {}
