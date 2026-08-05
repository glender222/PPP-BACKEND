import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../../common/authorization/auth-user';
import type { Permission } from '../../../common/authorization/permissions';
import { ScopePolicyService } from '../../../common/authorization/scope-policy.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopePolicy: ScopePolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission === undefined) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    this.scopePolicy.assertPermission(request.user, permission);
    return true;
  }
}
