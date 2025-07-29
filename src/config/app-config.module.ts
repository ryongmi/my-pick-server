import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { default as defaultConfig } from './default.js';
import { mysqlConfig, redisConfig } from './database.js';
import { jwtConfig } from './jwt.js';
import { validationSchema } from './validation.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [defaultConfig, mysqlConfig, redisConfig, jwtConfig],
      validationSchema,
    }),
  ],
})
export class AppConfigModule {}

