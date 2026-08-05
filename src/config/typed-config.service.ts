import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.validation';

@Injectable()
export class TypedConfigService extends ConfigService<AppEnv, true> {
  override get<K extends keyof AppEnv>(propertyPath: K): AppEnv[K] {
    return super.get(propertyPath, { infer: true });
  }
}
