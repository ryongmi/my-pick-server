import { DefaultConfig } from '@common/interfaces/index.js';

export default (): DefaultConfig => {
  const mode = process.env.NODE_ENV;

  if (mode !== 'local' && mode !== 'development' && mode !== 'production') {
    return {
      mode: undefined,
      port: parseInt(process.env.PORT ?? '8300', 10),
      tcpPort: parseInt(process.env.TCP_PORT ?? '8310', 10),
      corsOrigins: process.env.CORS_ORIGINS,
      myPickServerUrl: process.env.MY_PICK_SERVER_URL ?? 'http://localhost:8300/my-pick',
    };
  }

  return {
    mode,
    port: parseInt(process.env.PORT ?? '8300', 10),
    tcpPort: parseInt(process.env.TCP_PORT ?? '8310', 10),
    corsOrigins: process.env.CORS_ORIGINS,
    myPickServerUrl: process.env.MY_PICK_SERVER_URL ?? 'http://localhost:8300/my-pick',
  };
};

