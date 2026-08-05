import { TypedConfigService } from '../../config/typed-config.service';
import { AuthenticationProviderPort } from './ports/authentication-provider.port';
import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  it('rechaza el proveedor de desarrollo durante el arranque en producción', () => {
    const provider = { name: 'dev' } as unknown as AuthenticationProviderPort;
    const config = {
      get: jest.fn().mockReturnValue('production'),
    } as unknown as TypedConfigService;
    const module = new AuthModule(provider, config);

    expect(() => module.onModuleInit()).toThrow(/prohibido en producción/);
  });
});
