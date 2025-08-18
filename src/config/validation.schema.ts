import Joi from 'joi';

const defaultConfigSchema = {
  NODE_ENV: Joi.string().valid('local', 'development', 'production').required(),
  PORT: Joi.number().required(),
  TCP_PORT: Joi.number().required(),
  CORS_ORIGINS: Joi.string().required(),
};

const clientConfigSchema = {
  AUTH_SERVICE_HOST: Joi.string().default('auth-server'),
  AUTH_SERVICE_PORT: Joi.number().default(8010),
  AUTHZ_SERVICE_HOST: Joi.string().default('authz-server'),
  AUTHZ_SERVICE_PORT: Joi.number().default(8110),
  PORTAL_SERVICE_HOST: Joi.string().default('portal-server'),
  PORTAL_SERVICE_PORT: Joi.number().default(8210),
};

const mysqlConfigSchema = {
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),
  MYSQL_DATABASE: Joi.string().required(),
};

const redisConfigSchema = {
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().required(),
};

const youtubeConfigSchema = {
  YOUTUBE_API_KEY: Joi.string().required(),
};

const jwtConfigSchema = {
  JWT_ACCESS_PUBLIC_KEY_PATH: Joi.string().required(),
};

export const validationSchema = Joi.object({
  ...defaultConfigSchema,
  ...clientConfigSchema,
  ...mysqlConfigSchema,
  ...redisConfigSchema,
  ...youtubeConfigSchema,
  ...jwtConfigSchema,
});

