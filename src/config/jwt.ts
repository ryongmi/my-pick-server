import * as fs from 'fs';

import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  accessPublicKey: fs.readFileSync(process.env.JWT_ACCESS_PUBLIC_KEY_PATH!, 'utf-8'),
}));
