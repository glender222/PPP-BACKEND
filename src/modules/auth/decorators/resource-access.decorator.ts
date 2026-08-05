import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../../common/authorization/permissions';
import type { ResourceType } from '../../../common/authorization/resource-scope.service';

export const RESOURCE_ACCESS_KEY = 'resourceAccess';

export interface ResourceAccessSpec {
  permission: Permission;
  mode: 'load' | 'body';
  resourceType?: ResourceType;
  idParam?: string;
  bodyScopeField?: string;
}

export const ResourceAccess = (spec: ResourceAccessSpec) => SetMetadata(RESOURCE_ACCESS_KEY, spec);
