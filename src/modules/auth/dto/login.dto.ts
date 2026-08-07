import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'student.juliaca@upeu.edu.pe',
    description: 'Correo institucional UPeU de prueba',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'PppDev!2026',
    description: 'Contraseña de desarrollo',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
