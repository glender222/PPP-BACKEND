import { IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @IsUUID()
  requirementSnapshotId!: string;
}

export class UploadDigitalDocumentDto extends UploadDocumentDto {
  @IsObject()
  metadata!: Record<string, unknown>;
}

export class ObserveDocumentDto {
  @IsString()
  @IsNotEmpty()
  comentario!: string;
}

export class AnnulDocumentDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
