import Joi from 'joi';

const defaultConfigSchema = {
  NODE_ENV: Joi.string().valid('local', 'development', 'production').required(),
  PORT: Joi.number().default(8100),
  CORS_ORIGINS: Joi.string().required(),
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

const jwtConfigSchema = {
  JWT_ACCESS_PUBLIC_KEY_PATH: Joi.string().required(),
};

export const validationSchema = Joi.object({
  ...defaultConfigSchema,
  ...mysqlConfigSchema,
  ...redisConfigSchema,
  ...jwtConfigSchema,
});
