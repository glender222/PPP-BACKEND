import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { LetterRequestStatus } from '@prisma/client';

export class CreateLetterDto {
  @IsString()
  @IsNotEmpty()
  destinatario!: string;

  @IsString()
  @IsNotEmpty()
  cargo!: string;

  @IsString()
  @IsNotEmpty()
  empresaObjetivo!: string;

  @IsString()
  @IsNotEmpty()
  areaPractica!: string;

  @IsObject()
  datosPlantilla!: Record<string, unknown>;
}

export class UpdateLetterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinatario?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cargo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  empresaObjetivo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaPractica?: string;

  @IsOptional()
  @IsObject()
  datosPlantilla?: Record<string, unknown>;
}

export class ObserveLetterDto {
  @IsString()
  @IsNotEmpty()
  comentario!: string;
}

export class AnnulLetterDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

export class LetterStatusQueryDto {
  @IsOptional()
  @IsEnum(LetterRequestStatus)
  estado?: LetterRequestStatus;
}

export class SecretaryLetterQueryDto extends LetterStatusQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  q?: string;
}
