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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { AuthUser } from '../../common/authorization/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceAccess } from '../auth/decorators/resource-access.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AnnulLetterDto,
  CreateLetterDto,
  LetterStatusQueryDto,
  ObserveLetterDto,
  SecretaryLetterQueryDto,
  UpdateLetterDto,
} from './dto/letter.dto';
import { LetterService, LetterView } from './letter.service';

@ApiTags('Letters')
@ApiBearerAuth()
@Controller()
export class LetterController {
  constructor(private readonly letters: LetterService) {}

  @Post('letters')
  @Roles(Role.STUDENT)
  @RequirePermission('letter:create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLetterDto): Promise<LetterView> {
    return this.letters.create(user, dto);
  }

  @Get('letters/mine')
  @Roles(Role.STUDENT)
  @RequirePermission('letter:read')
  mine(@CurrentUser() user: AuthUser, @Query() query: LetterStatusQueryDto): Promise<LetterView[]> {
    return this.letters.listMine(user, query.estado);
  }

  @Get('letters/:id')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.COORDINATOR, Role.AUDITOR)
  @RequirePermission('letter:read')
  @ResourceAccess({ permission: 'letter:read', mode: 'load', resourceType: 'LetterRequest' })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LetterView> {
    return this.letters.getDetail(user, id);
  }

  @Put('letters/:id')
  @Roles(Role.STUDENT)
  @RequirePermission('letter:write')
  @ResourceAccess({ permission: 'letter:write', mode: 'load', resourceType: 'LetterRequest' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterDto,
  ): Promise<LetterView> {
    return this.letters.update(user, id, dto);
  }

  @Post('letters/:id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.STUDENT)
  @RequirePermission('letter:write')
  @ResourceAccess({ permission: 'letter:write', mode: 'load', resourceType: 'LetterRequest' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LetterView> {
    return this.letters.submit(user, id);
  }

  @Get('letters/:id/preview')
  @Roles(Role.STUDENT, Role.SECRETARY)
  @RequirePermission('letter:preview')
  @ResourceAccess({ permission: 'letter:preview', mode: 'load', resourceType: 'LetterRequest' })
  async preview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    response.type('application/pdf').send(await this.letters.preview(user, id));
  }

  @Post('letters/:id/resubmit')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.STUDENT)
  @RequirePermission('letter:write')
  @ResourceAccess({ permission: 'letter:write', mode: 'load', resourceType: 'LetterRequest' })
  resubmit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterDto,
  ): Promise<LetterView> {
    return this.letters.resubmit(user, id, dto);
  }

  @Get('letters/:id/history')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.COORDINATOR, Role.AUDITOR)
  @RequirePermission('letter:read')
  @ResourceAccess({ permission: 'letter:read', mode: 'load', resourceType: 'LetterRequest' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LetterView> {
    return this.letters.getDetail(user, id);
  }

  @Get('letters/:id/download')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.COORDINATOR, Role.AUDITOR)
  @RequirePermission('letter:download')
  @ResourceAccess({ permission: 'letter:download', mode: 'load', resourceType: 'LetterRequest' })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    response.type('application/pdf').send(await this.letters.download(user, id));
  }

  @Get('secretary/letters')
  @Roles(Role.SECRETARY)
  @RequirePermission('letter:review')
  secretaryQueue(
    @CurrentUser() user: AuthUser,
    @Query() query: SecretaryLetterQueryDto,
  ): Promise<LetterView[]> {
    return this.letters.listSecretary(user, query.estado, query.q);
  }

  @Post('secretary/letters/:id/observe')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SECRETARY)
  @RequirePermission('letter:review')
  @ResourceAccess({ permission: 'letter:review', mode: 'load', resourceType: 'LetterRequest' })
  observe(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObserveLetterDto,
  ): Promise<LetterView> {
    return this.letters.observe(user, id, dto.comentario);
  }

  @Post('secretary/letters/:id/approve')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.SECRETARY)
  @RequirePermission('letter:review')
  @ResourceAccess({ permission: 'letter:review', mode: 'load', resourceType: 'LetterRequest' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LetterView> {
    return this.letters.approve(user, id);
  }

  @Post('secretary/letters/:id/annul')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SECRETARY)
  @RequirePermission('letter:review')
  @ResourceAccess({ permission: 'letter:review', mode: 'load', resourceType: 'LetterRequest' })
  annul(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnulLetterDto,
  ): Promise<LetterView> {
    return this.letters.annul(user, id, dto.motivo);
  }
}
