import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TypedConfigService } from './config/typed-config.service';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  const config = app.get(TypedConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  app.setGlobalPrefix(API_PREFIX);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );

  const corsOrigins = config.get('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins === '*' ? true : corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const details = errors.map((error) => ({
          property: error.property,
          value: error.value as unknown,
          constraints: error.constraints,
        }));
        return new BadRequestException({ message: 'Validación fallida', details });
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger), isProduction));

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  if (config.get('ENABLE_API_DOCS')) {
    const documentConfig = new DocumentBuilder()
      .setTitle('PPP Backend API')
      .setDescription(
        'API del Sistema de Prácticas Preprofesionales (PPP) — UPeU. REST bajo /api/v1 con envelope de errores uniforme.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    app.use('/api/docs', apiReference({ content: document }));
  }
}
