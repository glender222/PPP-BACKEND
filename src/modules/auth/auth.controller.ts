import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SecurityEventType } from '@prisma/client';
import type { ActiveRoleAssignment, AuthUser } from '../../common/authorization/auth-user';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequirePermission } from './decorators/require-permission.decorator';
import { LoginDto } from './dto/login.dto';
import {
  AUTHENTICATION_PROVIDER,
  AuthenticationProviderPort,
} from './ports/authentication-provider.port';

export interface MeResponse {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    state: string;
  };
  roles: ActiveRoleAssignment[];
  userProfile: { fullName: string; displayName: string | null; campusId: string | null } | null;
  studentProfile: {
    code: string;
    dni: string;
    cycle: string | null;
    campusId: string;
    schoolId: string;
    complete: boolean;
  } | null;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    state: string;
  };
  roles: ActiveRoleAssignment[];
}

@Controller()
export class AuthController {
  constructor(
    @Inject(AUTHENTICATION_PROVIDER)
    private readonly provider: AuthenticationProviderPort,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: Request): Promise<LoginResponse> {
    try {
      const result = await this.provider.authenticate(dto.email, dto.password);
      await this.audit.recordSecurity({
        userId: result.user.id,
        type: SecurityEventType.LOGIN_SUCCESS,
        ipAddress: request.ip,
      });
      return {
        accessToken: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          state: result.user.state,
        },
        roles: result.user.roles,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.audit.recordSecurity({
          type: SecurityEventType.LOGIN_FAILURE,
          ipAddress: request.ip,
          detail: { email: dto.email },
        });
      }
      throw error;
    }
  }

  @Get('auth/me')
  @RequirePermission('auth:me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.authService.me(user);
  }

  @Get('me')
  @RequirePermission('auth:me')
  meAlias(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.authService.me(user);
  }
}
