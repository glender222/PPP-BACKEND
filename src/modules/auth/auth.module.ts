import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { TypedConfigService } from '../../config/typed-config.service';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ResourceAccessGuard } from './guards/resource-access.guard';
import { RolesGuard } from './guards/roles.guard';
import {
  AUTHENTICATION_PROVIDER,
  AuthenticationProviderPort,
} from './ports/authentication-provider.port';
import { DevAuthenticationProvider } from './providers/dev-authentication.provider';

@Module({
  imports: [
    AuthorizationModule,
    AuditModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService) => ({
        secret: config.get('APP_JWT_SECRET'),
        signOptions: { expiresIn: config.get('APP_JWT_TTL'), algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTHENTICATION_PROVIDER, useClass: DevAuthenticationProvider },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ResourceAccessGuard },
  ],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    @Inject(AUTHENTICATION_PROVIDER)
    private readonly provider: AuthenticationProviderPort,
    private readonly config: TypedConfigService,
  ) {}

  onModuleInit(): void {
    if (this.provider.name === 'dev' && this.config.get('NODE_ENV') === 'production') {
      throw new Error(
        'AuthModule: el proveedor de autenticación de desarrollo está prohibido en producción',
      );
    }
  }
}
