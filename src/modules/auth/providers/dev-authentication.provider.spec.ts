import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypedConfigService } from '../../../config/typed-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { DevAuthenticationProvider } from './dev-authentication.provider';

function makeProvider(nodeEnv: string): { provider: DevAuthenticationProvider; get: jest.Mock } {
  const get = jest.fn((key: string) =>
    key === 'NODE_ENV' ? nodeEnv : key === 'DEV_AUTH_PASSWORD' ? 'PppDev!2026' : undefined,
  );
  const config = { get } as unknown as TypedConfigService;
  const jwt = {} as unknown as JwtService;
  const prisma = {} as unknown as PrismaService;
  const authService = {} as unknown as AuthService;
  return { provider: new DevAuthenticationProvider(config, jwt, prisma, authService), get };
}

describe('DevAuthenticationProvider', () => {
  it('rechaza el modo de desarrollo en producción', async () => {
    const { provider } = makeProvider('production');

    await expect(
      provider.authenticate('student.juliaca@upeu.edu.pe', 'PppDev!2026'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza contraseñas incorrectas en desarrollo', async () => {
    const { provider } = makeProvider('development');

    await expect(
      provider.authenticate('student.juliaca@upeu.edu.pe', 'contraseña-incorrecta'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
