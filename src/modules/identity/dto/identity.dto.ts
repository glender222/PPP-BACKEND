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
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

export class CreateStudentProfileDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsOptional()
  @IsString()
  cycle?: string;

  @IsUUID()
  campusId!: string;

  @IsUUID()
  schoolId!: string;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStudentProfileDto)
  studentProfile?: CreateStudentProfileDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AssignRoleDto)
  roles?: AssignRoleDto[];
}
