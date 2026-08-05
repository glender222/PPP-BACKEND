import * as Joi from 'joi';

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
export type AuthProviderName = 'dev';
export type JwtTtl = `${number}${'s' | 'm' | 'h' | 'd'}`;

export interface AppEnv {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: LogLevel;
  ENABLE_API_DOCS: boolean;
  AUTH_PROVIDER: AuthProviderName;
  APP_JWT_SECRET: string;
  APP_JWT_TTL: JwtTtl;
  DEV_AUTH_PASSWORD: string;
  MAX_PDF_SIZE_BYTES: number;
}

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  CORS_ORIGINS: Joi.string().default('*'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  ENABLE_API_DOCS: Joi.boolean().truthy('true', '1').falsy('false', '0').default(true),
  AUTH_PROVIDER: Joi.string().valid('dev').default('dev'),
  APP_JWT_SECRET: Joi.string().min(16).default('dev-only-jwt-secret-change-me'),
  APP_JWT_TTL: Joi.string().default('8h'),
  DEV_AUTH_PASSWORD: Joi.string().min(6).default('PppDev!2026'),
  MAX_PDF_SIZE_BYTES: Joi.number()
    .integer()
    .positive()
    .default(10 * 1024 * 1024),
});

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
  }) as { error?: Joi.ValidationError; value: AppEnv };
  if (result.error) {
    throw new Error(`Configuración de entorno inválida: ${result.error.message}`);
  }
  return result.value;
}
