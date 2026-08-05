import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypedConfigService } from './typed-config.service';

@Global()
@Module({
  providers: [{ provide: TypedConfigService, useExisting: ConfigService }],
  exports: [TypedConfigService],
})
export class TypedConfigModule {}
