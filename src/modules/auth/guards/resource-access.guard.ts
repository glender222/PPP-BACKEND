import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../../../common/authorization/auth-user';
import { ResourceScopeService } from '../../../common/authorization/resource-scope.service';
import {
  ScopePolicyService,
  ScopedResource,
} from '../../../common/authorization/scope-policy.service';
import { RESOURCE_ACCESS_KEY, ResourceAccessSpec } from '../decorators/resource-access.decorator';

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopePolicy: ScopePolicyService,
    private readonly resourceScope: ResourceScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const spec = this.reflector.getAllAndOverride<ResourceAccessSpec | undefined>(
      RESOURCE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (spec === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const resource = await this.resolveResource(spec, context);

    this.scopePolicy.assertResourceAccess(request.user, spec.permission, resource);
    return true;
  }

  private async resolveResource(
    spec: ResourceAccessSpec,
    context: ExecutionContext,
  ): Promise<ScopedResource> {
    if (spec.mode === 'body') {
      const body = context.switchToHttp().getRequest<Request>().body as
        Record<string, unknown> | undefined;
      const campusId = body?.[spec.bodyScopeField ?? 'campusId'];
      if (typeof campusId !== 'string') {
        throw new BadRequestException('Falta el campus del recurso');
      }
      return { campusId };
    }

    const request = context.switchToHttp().getRequest<Request>();
    const id = request.params[spec.idParam ?? 'id'];
    if (typeof id !== 'string') {
      throw new BadRequestException('Falta el identificador del recurso');
    }
    const loaded = await this.resourceScope.getScopedResource(
      spec.resourceType ?? 'AcademicPeriod',
      id,
    );
    if (loaded === null) {
      throw new NotFoundException('Recurso no encontrado');
    }
    return loaded;
  }
}
