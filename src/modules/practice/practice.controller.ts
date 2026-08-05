import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ActivatePracticeDto,
  CreatePracticeDto,
  PracticeQueryDto,
  UpdatePracticeDto,
} from './dto/practice.dto';
import { PracticeService } from './practice.service';

@ApiTags('Practices')
@ApiBearerAuth()
@Controller()
export class PracticeController {
  constructor(private readonly practices: PracticeService) {}

  @Post('practices')
  @Roles(Role.STUDENT)
  @RequirePermission('practice:create')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreatePracticeDto): Promise<unknown> {
    return this.practices.create(actor, dto);
  }

  @Get('practices/mine')
  @Roles(Role.STUDENT)
  @RequirePermission('practice:read')
  mine(@CurrentUser() actor: AuthUser, @Query() query: PracticeQueryDto): Promise<unknown[]> {
    return this.practices.listMine(actor, query);
  }

  @Get('practices')
  @Roles(Role.COORDINATOR)
  @RequirePermission('practice:read')
  scoped(@CurrentUser() actor: AuthUser, @Query() query: PracticeQueryDto): Promise<unknown[]> {
    return this.practices.listScoped(actor, query);
  }

  @Get('practices/:id')
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR)
  @RequirePermission('practice:read')
  @ResourceAccess({ permission: 'practice:read', mode: 'load', resourceType: 'Practice' })
  detail(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.practices.getDetail(actor, id);
  }

  @Put('practices/:id')
  @Roles(Role.STUDENT)
  @RequirePermission('practice:write')
  @ResourceAccess({ permission: 'practice:write', mode: 'load', resourceType: 'Practice' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePracticeDto,
  ): Promise<unknown> {
    return this.practices.update(actor, id, dto);
  }

  @Get('practices/:id/requirements')
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.SUPERVISOR, Role.AUDITOR)
  @RequirePermission('practice:read')
  @ResourceAccess({ permission: 'practice:read', mode: 'load', resourceType: 'Practice' })
  requirements(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown[]> {
    return this.practices.requirements(actor, id);
  }

  @Post('practices/:id/authorize')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR)
  @RequirePermission('practice:authorize')
  @ResourceAccess({ permission: 'practice:authorize', mode: 'load', resourceType: 'Practice' })
  authorize(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.practices.authorize(actor, id);
  }

  @Post('practices/:id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR)
  @RequirePermission('practice:activate')
  @ResourceAccess({ permission: 'practice:activate', mode: 'load', resourceType: 'Practice' })
  activate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivatePracticeDto,
  ): Promise<unknown> {
    return this.practices.activate(actor, id, dto);
  }
}
