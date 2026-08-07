import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'Ing. Juan Pérez Choque' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiPropertyOptional({ example: 'Gerente de Sistemas' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cargo?: string;

  @ApiPropertyOptional({ example: 'juan.perez@techsolutions.pe' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  correo?: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telefono?: string;

  @ApiPropertyOptional({ example: { anexo: '102' } })
  @IsOptional()
  @IsObject()
  otrosDatosContacto?: Record<string, unknown>;
}

export class CreateCompanyDto {
  @ApiPropertyOptional({ example: '20123456789' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ruc?: string;

  @ApiProperty({ example: 'TechSolutions S.A.C.' })
  @IsString()
  @IsNotEmpty()
  razonSocial!: string;

  @ApiPropertyOptional({ example: 'TechSolutions' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombreComercial?: string;

  @ApiProperty({ example: 'Av. Las Flores 123, San Isidro, Lima' })
  @IsString()
  @IsNotEmpty()
  direccion!: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contacto?: string;

  @ApiPropertyOptional({ example: 'Tecnología de la Información' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  esExtranjera!: boolean;

  @ApiPropertyOptional({ type: () => CreateCompanyRepresentativeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyRepresentativeDto)
  representante?: CreateCompanyRepresentativeDto;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'TechSolutions S.A.C.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  razonSocial?: string;

  @ApiPropertyOptional({ example: 'TechSolutions' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombreComercial?: string;

  @ApiPropertyOptional({ example: 'Av. Las Flores 123, San Isidro, Lima' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  direccion?: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contacto?: string;

  @ApiPropertyOptional({ example: 'Tecnología de la Información' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area?: string;
}

export class CompanyQueryDto {
  @ApiPropertyOptional({ example: 'TechSolutions' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '20123456789' })
  @IsOptional()
  @IsString()
  ruc?: string;
}
