import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'auth-server',
          port: 8010,
        },
      },
      {
        name: 'AUTHZ_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'authz-server',
          port: 8110,
        },
      },
      {
        name: 'PORTAL_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'portal-server',
          port: 8210,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class SharedClientsModule {}
