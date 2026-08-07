import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'ID del snapshot del requisito' })
  @IsUUID()
  requirementSnapshotId!: string;
}

export class UploadDigitalDocumentDto extends UploadDocumentDto {
  @ApiProperty({ example: { ruc: '20123456789', razonSocial: 'TechSolutions S.A.C.' } })
  @IsObject()
  metadata!: Record<string, unknown>;
}

export class ObserveDocumentDto {
  @ApiProperty({ example: 'El PDF presentado no tiene la firma del representante de la empresa.' })
  @IsString()
  @IsNotEmpty()
  comentario!: string;
}

export class AnnulDocumentDto {
  @ApiProperty({ example: 'Documento no corresponde al convenio de la empresa asignada.' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
