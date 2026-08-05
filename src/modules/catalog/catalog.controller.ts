import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CampusView, CatalogService, PeriodView, SchoolView } from './catalog.service';
import { CreatePeriodDto } from './dto/catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('campuses')
  @RequirePermission('campus:read')
  campuses(): Promise<CampusView[]> {
    return this.catalogService.listCampuses();
  }

  @Get('schools')
  @RequirePermission('school:read')
  schools(@Query('campusId') campusId?: string): Promise<SchoolView[]> {
    return this.catalogService.listSchools(campusId);
  }

  @Get('periods')
  @Roles(Role.COORDINATOR, Role.SYSTEM_ADMIN)
  @RequirePermission('academic-period:read')
  periods(@CurrentUser() user: AuthUser): Promise<PeriodView[]> {
    return this.catalogService.listPeriods(user);
  }

  @Post('periods')
  @Roles(Role.COORDINATOR, Role.SYSTEM_ADMIN)
  @RequirePermission('academic-period:write')
  @ResourceAccess({ permission: 'academic-period:write', mode: 'body', bodyScopeField: 'campusId' })
  createPeriod(@CurrentUser() user: AuthUser, @Body() dto: CreatePeriodDto): Promise<PeriodView> {
    return this.catalogService.createPeriod(user, dto);
  }

  @Post('periods/:id/open')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR, Role.SYSTEM_ADMIN)
  @RequirePermission('academic-period:write')
  @ResourceAccess({
    permission: 'academic-period:write',
    mode: 'load',
    resourceType: 'AcademicPeriod',
    idParam: 'id',
  })
  openPeriod(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PeriodView> {
    return this.catalogService.openPeriod(user, id);
  }

  @Post('periods/:id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.COORDINATOR, Role.SYSTEM_ADMIN)
  @RequirePermission('academic-period:write')
  @ResourceAccess({
    permission: 'academic-period:write',
    mode: 'load',
    resourceType: 'AcademicPeriod',
    idParam: 'id',
  })
  closePeriod(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PeriodView> {
    return this.catalogService.closePeriod(user, id);
  }
}
