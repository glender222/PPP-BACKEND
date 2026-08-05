import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @Roles(Role.SYSTEM_ADMIN, Role.AUDITOR, Role.COORDINATOR)
  @RequirePermission('audit:read')
  events(@CurrentUser() user: AuthUser) {
    return this.auditService.listEvents(user);
  }
}
