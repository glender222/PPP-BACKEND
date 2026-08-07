import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Role } from '@prisma/client';

export class AssignRoleDto {
  @ApiProperty({ enum: Role, example: Role.STUDENT })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

export class CreateStudentProfileDto {
  @ApiProperty({ example: '2024-0001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: '71234567' })
  @IsString()
  @IsNotEmpty()
  dni!: string;

  @ApiPropertyOptional({ example: 'IX' })
  @IsOptional()
  @IsString()
  cycle?: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  campusId!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsUUID()
  schoolId!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'nuevo.estudiante@upeu.edu.pe' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nuevo Estudiante UPeU' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ type: () => CreateStudentProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStudentProfileDto)
  studentProfile?: CreateStudentProfileDto;

  @ApiPropertyOptional({ type: () => [AssignRoleDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AssignRoleDto)
  roles?: AssignRoleDto[];
}
