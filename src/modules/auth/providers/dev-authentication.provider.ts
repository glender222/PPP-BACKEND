import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserState } from '@prisma/client';
import { TypedConfigService } from '../../../config/typed-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import {
  AuthenticationProviderPort,
  AuthenticationResult,
} from '../ports/authentication-provider.port';

@Injectable()
export class DevAuthenticationProvider implements AuthenticationProviderPort {
  readonly name = 'dev';

  constructor(
    private readonly config: TypedConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async authenticate(email: string, password: string): Promise<AuthenticationResult> {
    this.assertAllowed();

    if (password !== this.config.get('DEV_AUTH_PASSWORD')) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const identity = await this.prisma.institutionalIdentity.findUnique({
      where: { institutionalEmail: email.toLowerCase().trim() },
      include: { user: { select: { id: true, state: true } } },
    });
    if (identity?.user.state !== UserState.ACTIVE) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = await this.jwt.signAsync({ sub: identity.userId });
    const user = await this.authService.loadAuthUser(identity.userId);
    return { token, user };
  }

  private assertAllowed(): void {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new UnauthorizedException(
        'El proveedor de autenticación de desarrollo no está disponible en producción',
      );
    }
  }
}
