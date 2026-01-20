import * as fs from 'fs';

import { registerAs } from '@nestjs/config';

import { JwtConfig } from '@/common/interfaces/config.interfaces.js';

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessPublicKey: fs.readFileSync(process.env.JWT_ACCESS_PUBLIC_KEY_PATH!, 'utf-8'),
  })
);
