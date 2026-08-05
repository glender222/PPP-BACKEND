import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const baseEnv: Record<string, unknown> = {
    DATABASE_URL: 'postgresql://ppp:ppp_dev_password@localhost:5433/ppp_dev?schema=public',
  };

  it('aplica valores por defecto cuando faltan opcionales', () => {
    const env = validateEnv(baseEnv);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: '*',
      LOG_LEVEL: 'info',
      ENABLE_API_DOCS: true,
    });
  });

  it('coerciona valores tipados desde strings', () => {
    const env = validateEnv({
      ...baseEnv,
      PORT: '8080',
      NODE_ENV: 'test',
      ENABLE_API_DOCS: 'false',
    });
    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('test');
    expect(env.ENABLE_API_DOCS).toBe(false);
  });

  it('rechaza config sin DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza valores inválidos', () => {
    expect(() => validateEnv({ ...baseEnv, PORT: 'abc' })).toThrow();
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow();
  });
});
