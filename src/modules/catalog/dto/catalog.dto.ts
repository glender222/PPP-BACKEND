import { IsISO8601, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePeriodDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsUUID()
  campusId!: string;
}
