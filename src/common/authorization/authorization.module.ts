import { Global, Module } from '@nestjs/common';
import { ResourceScopeService } from './resource-scope.service';
import { ScopePolicyService } from './scope-policy.service';

@Global()
@Module({
  providers: [ScopePolicyService, ResourceScopeService],
  exports: [ScopePolicyService, ResourceScopeService],
})
export class AuthorizationModule {}
