import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { TypedConfigModule } from './config/typed-config.module';
import { validateEnv } from './config/env.validation';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ClosingModule } from './modules/closing/closing.module';
import { CompanyModule } from './modules/company/company.module';
import { DocumentModule } from './modules/document/document.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LetterModule } from './modules/letter/letter.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PracticeModule } from './modules/practice/practice.module';
import { SupervisionModule } from './modules/supervision/supervision.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypedConfigModule,
    AuthorizationModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          genReqId: (req, res) => {
            const id = randomUUID();
            res?.setHeader('x-request-id', id);
            return id;
          },
          level: config.get<string>('LOG_LEVEL'),
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie'],
            remove: true,
          },
          customProps: () => ({ service: 'ppp-backend' }),
          transport:
            config.get<string>('NODE_ENV') === 'production'
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
        },
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    IdentityModule,
    CatalogModule,
    AuditModule,
    LetterModule,
    CompanyModule,
    PracticeModule,
    DocumentModule,
    SupervisionModule,
    EvaluationModule,
    ClosingModule,
  ],
})
export class AppModule {}
