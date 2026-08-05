import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateCompanyRepresentativeDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cargo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  correo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telefono?: string;

  @IsOptional()
  @IsObject()
  otrosDatosContacto?: Record<string, unknown>;
}

export class CreateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ruc?: string;

  @IsString()
  @IsNotEmpty()
  razonSocial!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombreComercial?: string;

  @IsString()
  @IsNotEmpty()
  direccion!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contacto?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area?: string;

  @IsBoolean()
  esExtranjera!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyRepresentativeDto)
  representante?: CreateCompanyRepresentativeDto;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  direccion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contacto?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area?: string;
}

export class CompanyQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  ruc?: string;
}
