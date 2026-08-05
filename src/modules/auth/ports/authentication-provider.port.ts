import type { AuthUser } from '../../../common/authorization/auth-user';

export interface AuthenticationResult {
  token: string;
  user: AuthUser;
}

export interface AuthenticationProviderPort {
  readonly name: string;
  authenticate(email: string, password: string): Promise<AuthenticationResult>;
}

export const AUTHENTICATION_PROVIDER = Symbol('AUTHENTICATION_PROVIDER');
