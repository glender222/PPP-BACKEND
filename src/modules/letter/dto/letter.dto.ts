import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { LetterRequestStatus } from '@prisma/client';

export class CreateLetterDto {
  @ApiProperty({ example: 'Ing. Carlos Mendoza (Gerente RRHH)' })
  @IsString()
  @IsNotEmpty()
  destinatario!: string;

  @ApiProperty({ example: 'Gerente de Recursos Humanos' })
  @IsString()
  @IsNotEmpty()
  cargo!: string;

  @ApiProperty({ example: 'TechSolutions S.A.C.' })
  @IsString()
  @IsNotEmpty()
  empresaObjetivo!: string;

  @ApiProperty({ example: 'Desarrollo de software y sistemas' })
  @IsString()
  @IsNotEmpty()
  areaPractica!: string;

  @ApiProperty({ example: { modalidad: 'PRESENCIAL', duracionMeses: 4 } })
  @IsObject()
  datosPlantilla!: Record<string, unknown>;
}

export class UpdateLetterDto {
  @ApiPropertyOptional({ example: 'Ing. Carlos Mendoza (Gerente RRHH)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinatario?: string;

  @ApiPropertyOptional({ example: 'Gerente de Recursos Humanos' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cargo?: string;

  @ApiPropertyOptional({ example: 'TechSolutions S.A.C.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  empresaObjetivo?: string;

  @ApiPropertyOptional({ example: 'Desarrollo de software y sistemas' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaPractica?: string;

  @ApiPropertyOptional({ example: { modalidad: 'PRESENCIAL', duracionMeses: 4 } })
  @IsOptional()
  @IsObject()
  datosPlantilla?: Record<string, unknown>;
}

export class ObserveLetterDto {
  @ApiProperty({ example: 'El nombre de la empresa no coincide con la razon social oficial.' })
  @IsString()
  @IsNotEmpty()
  comentario!: string;
}

export class AnnulLetterDto {
  @ApiProperty({ example: 'Solicitud duplicada creada por error.' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

export class LetterStatusQueryDto {
  @ApiPropertyOptional({ enum: LetterRequestStatus, example: LetterRequestStatus.SUBMITTED })
  @IsOptional()
  @IsEnum(LetterRequestStatus)
  estado?: LetterRequestStatus;
}

export class SecretaryLetterQueryDto extends LetterStatusQueryDto {
  @ApiPropertyOptional({ example: '2024-0001' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  q?: string;
}

export class UpdateSignatureConfigDto {
  @ApiProperty({ example: 'Dr. Carlos Eduardo Méndez Ruiz' })
  @IsString()
  @IsNotEmpty()
  signerName!: string;

  @ApiProperty({ example: 'Director de Carrera - Ingeniería de Sistemas' })
  @IsString()
  @IsNotEmpty()
  signerTitle!: string;

  @ApiPropertyOptional({ example: 'Facultad de Ingeniería y Arquitectura' })
  @IsOptional()
  @IsString()
  signerFaculty?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;
}

