import type { Session, SessionUser } from '../auth/session';
import { graphqlRequest } from './graphql';

export const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      id
      email
    }
  }
`;

export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      tokenType
      expiresAt
      user {
        id
        email
      }
    }
  }
`;

export const LOGOUT_MUTATION = `
  mutation Logout {
    logout
  }
`;

export const ME_QUERY = `
  query Me {
    me {
      id
      email
    }
  }
`;

export interface Credentials {
  email: string;
  password: string;
}

interface LoginPayload {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: SessionUser;
}

const credentialsInput = ({ email, password }: Credentials) => ({ input: { email: email.trim(), password } });

/** Creates an account. The backend returns the new user, never a token: the user logs in afterwards. */
export async function registerRequest(credentials: Credentials): Promise<SessionUser> {
  const data = await graphqlRequest<{ register: SessionUser }>(REGISTER_MUTATION, credentialsInput(credentials), {
    accessToken: null,
  });
  return data.register;
}

export async function loginRequest(credentials: Credentials): Promise<Session> {
  const data = await graphqlRequest<{ login: LoginPayload }>(LOGIN_MUTATION, credentialsInput(credentials), {
    accessToken: null,
  });
  const { accessToken, expiresAt, user } = data.login;
  return { accessToken, expiresAt, user: { id: user.id, email: user.email } };
}

/** Revokes `accessToken` on the server, so it stops working even if it was copied. */
export async function logoutRequest(accessToken: string): Promise<void> {
  await graphqlRequest<{ logout: boolean }>(LOGOUT_MUTATION, undefined, { accessToken });
}

/** The user `accessToken` belongs to. Refused with AUTH_NOT_AUTHENTICATED if the token is no longer valid. */
export async function meRequest(accessToken: string): Promise<SessionUser> {
  const data = await graphqlRequest<{ me: SessionUser }>(ME_QUERY, undefined, { accessToken });
  return data.me;
}
