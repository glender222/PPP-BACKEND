import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'ID de la empresa' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7', description: 'ID del representante' })
  @IsUUID()
  companyRepresentativeId!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa8', description: 'ID del periodo académico' })
  @IsUUID()
  academicPeriodId!: string;

  @ApiProperty({ example: 'Asistente de Desarrollo de Software' })
  @IsString()
  @IsNotEmpty()
  areaCargo!: string;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  @IsISO8601()
  fechaInicio!: string;

  @ApiProperty({ example: '2026-06-15T00:00:00.000Z' })
  @IsISO8601()
  fechaFin!: string;

  @ApiProperty({ example: 'Lunes a Viernes 08:00 - 17:00' })
  @IsString()
  @IsNotEmpty()
  horario!: string;

  @ApiProperty({ example: 'PRESENCIAL' })
  @IsString()
  @IsNotEmpty()
  modalidad!: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa9' })
  @IsOptional()
  @IsUUID()
  letterRequestId?: string;
}

export class UpdatePracticeDto {
  @ApiProperty({ example: 1, description: 'Versión del registro para control optimista' })
  @IsInt()
  @IsPositive()
  version!: number;

  @ApiPropertyOptional({ example: 'Analista Programador Junior' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaCargo?: string;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-06-15T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  fechaFin?: string;

  @ApiPropertyOptional({ example: 'Lunes a Viernes 08:00 - 17:00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  horario?: string;

  @ApiPropertyOptional({ example: 'HIBRIDO' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  modalidad?: string;
}

export class PracticeQueryDto {
  @ApiPropertyOptional({ enum: PracticeStatus, example: PracticeStatus.PREPARATION })
  @IsOptional()
  @IsEnum(PracticeStatus)
  estado?: PracticeStatus;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa8' })
  @IsOptional()
  @IsUUID()
  academicPeriodId?: string;

  @ApiPropertyOptional({ example: '2024-0001' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  q?: string;
}

export class ActivatePracticeDto {
  @ApiPropertyOptional({ example: 'Requisitos verificados y apto para inicio.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  justificacion?: string;
}
