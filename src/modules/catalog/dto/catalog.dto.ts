import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePeriodDto {
  @ApiProperty({ example: '2026-I' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2026-01-05T00:00:00.000Z' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-07-31T00:00:00.000Z' })
  @IsISO8601()
  endDate!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'ID del campus' })
  @IsUUID()
  campusId!: string;
}
