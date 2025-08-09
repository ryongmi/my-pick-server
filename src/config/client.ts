import { registerAs } from '@nestjs/config';

export const clientConfig = registerAs('client', () => ({
  authServiceHost: process.env.AUTH_SERVICE_HOST,
  authServicePort: parseInt(process.env.AUTH_SERVICE_PORT ?? '8010', 10),
  authzServiceHost: process.env.AUTHZ_SERVICE_HOST,
  authzServicePort: parseInt(process.env.AUTHZ_SERVICE_PORT ?? '8110', 10),
  portalServiceHost: process.env.PORTAL_SERVICE_HOST,
  portalServicePort: parseInt(process.env.PORTAL_SERVICE_PORT ?? '8210', 10),
}));
