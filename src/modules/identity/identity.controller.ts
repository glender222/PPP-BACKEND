import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role, UserState } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssignRoleDto, CreateUserDto } from './dto/identity.dto';
import { IdentityService, UserAdminView } from './identity.service';

@Controller('admin/users')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:read')
  list(): Promise<UserAdminView[]> {
    return this.identityService.listUsers();
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:read')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<UserAdminView> {
    return this.identityService.getUser(id);
  }

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:create')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto): Promise<UserAdminView> {
    return this.identityService.createUser(actor, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:activate')
  activate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserAdminView> {
    return this.identityService.setUserState(actor, id, UserState.ACTIVE);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:activate')
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserAdminView> {
    return this.identityService.setUserState(actor, id, UserState.INACTIVE);
  }

  @Post(':id/role-assignments')
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:assign-role')
  assignRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ): Promise<UserAdminView> {
    return this.identityService.assignRole(actor, id, dto);
  }

  @Post('role-assignments/:assignmentId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SYSTEM_ADMIN)
  @RequirePermission('user:assign-role')
  deactivateAssignment(
    @CurrentUser() actor: AuthUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ): Promise<UserAdminView> {
    return this.identityService.deactivateRoleAssignment(actor, assignmentId);
  }
}
