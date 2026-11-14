import { describe, it, expect, vi } from 'vitest';
import { AuthService, AuthError } from './AuthService';
import type { HttpClient } from '../HttpClient';

function mockClient(response: unknown): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue(response),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

describe('AuthService', () => {
  describe('register', () => {
    it('returns the created user on success', async () => {
      const client = mockClient({
        data: { register: { id: 'u1', email: 'a@b.com' } },
      });
      const service = new AuthService(client);

      const result = await service.register({ email: 'a@b.com', password: 'Valid@Pass123' });

      expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
      expect(client.post).toHaveBeenCalledWith('/graphql', expect.objectContaining({
        variables: { input: { email: 'a@b.com', password: 'Valid@Pass123' } },
      }));
    });

    it('throws AuthError when the API returns a GraphQL error', async () => {
      const client = mockClient({
        errors: [{ message: "An account with the email 'a@b.com' already exists.", extensions: { code: 'BAD_USER_INPUT' } }],
      });
      const service = new AuthService(client);

      await expect(service.register({ email: 'a@b.com', password: 'x' }))
        .rejects.toThrow(AuthError);
    });

    it('throws AuthError when data.register is null', async () => {
      const client = mockClient({ data: { register: null } });
      const service = new AuthService(client);

      await expect(service.register({ email: 'a@b.com', password: 'x' }))
        .rejects.toThrow('Registration failed');
    });
  });
});

