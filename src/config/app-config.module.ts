import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { default as defaultConfig } from './default.js';
import { mysqlConfig, redisConfig } from './database.js';
import { jwtConfig } from './jwt.js';
import { validationSchema } from './validation.schema.js';
import { youtubeConfig } from './youtube.js';
import { clientConfig } from './client.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [defaultConfig, clientConfig, mysqlConfig, redisConfig, youtubeConfig, jwtConfig],
      validationSchema,
    }),
  ],
})
export class AppConfigModule {}
