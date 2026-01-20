export interface DefaultConfig {
  mode: 'local' | 'development' | 'production' | undefined;
  port: number | undefined;
  tcpPort: number | undefined;
  corsOrigins: string | undefined;
}

export interface ClientConfig {
  authServiceHost: string | undefined;
  authServicePort: number | undefined;
  authzServiceHost: string | undefined;
  authzServicePort: number | undefined;
  portalServiceHost: string | undefined;
  portalServicePort: number | undefined;
}

export interface MysqlConfig {
  host: string | undefined;
  port: number | undefined;
  username: string | undefined;
  password: string | undefined;
  name: string | undefined;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string | undefined;
  port: number | undefined;
  password: string | undefined;
  keyPrefix: string | undefined;
}

export interface YouTubeConfig {
  youtubeApiKey: string | undefined;
}

export interface NaverConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUrl: string | undefined;
  tokenUrl: string | undefined;
  userInfoUrl: string | undefined;
}

export interface JwtConfig {
  accessPublicKey: string | undefined;
}
