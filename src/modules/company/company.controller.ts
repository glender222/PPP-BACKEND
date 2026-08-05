import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyService } from './company.service';
import {
  CompanyQueryDto,
  CreateCompanyDto,
  CreateCompanyRepresentativeDto,
  UpdateCompanyDto,
} from './dto/company.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get()
  @Roles(Role.STUDENT, Role.COORDINATOR, Role.AUDITOR)
  @RequirePermission('company:read')
  list(@CurrentUser() actor: AuthUser, @Query() query: CompanyQueryDto): Promise<unknown[]> {
    return this.companies.list(actor, query);
  }

  @Post()
  @Roles(Role.STUDENT, Role.COORDINATOR)
  @RequirePermission('company:create')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCompanyDto): Promise<unknown> {
    return this.companies.create(actor, dto);
  }

  @Put(':id')
  @Roles(Role.STUDENT, Role.COORDINATOR)
  @RequirePermission('company:write')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<unknown> {
    return this.companies.update(actor, id, dto);
  }

  @Post(':id/representatives')
  @Roles(Role.STUDENT, Role.COORDINATOR)
  @RequirePermission('company:write')
  addRepresentative(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompanyRepresentativeDto,
  ): Promise<unknown> {
    return this.companies.addRepresentative(actor, id, dto);
  }
}
