import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { PracticeStatus } from '@prisma/client';

export class CreatePracticeDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  companyRepresentativeId!: string;

  @IsUUID()
  academicPeriodId!: string;

  @IsString()
  @IsNotEmpty()
  areaCargo!: string;

  @IsISO8601()
  fechaInicio!: string;

  @IsISO8601()
  fechaFin!: string;

  @IsString()
  @IsNotEmpty()
  horario!: string;

  @IsString()
  @IsNotEmpty()
  modalidad!: string;

  @IsOptional()
  @IsUUID()
  letterRequestId?: string;
}

export class UpdatePracticeDto {
  @IsInt()
  @IsPositive()
  version!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaCargo?: string;

  @IsOptional()
  @IsISO8601()
  fechaInicio?: string;

  @IsOptional()
  @IsISO8601()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  horario?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  modalidad?: string;
}

export class PracticeQueryDto {
  @IsOptional()
  @IsEnum(PracticeStatus)
  estado?: PracticeStatus;

  @IsOptional()
  @IsUUID()
  academicPeriodId?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  q?: string;
}

export class ActivatePracticeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  justificacion?: string;
}
