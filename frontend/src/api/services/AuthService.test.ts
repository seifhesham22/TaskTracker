import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../HttpClient';
import { AuthError, AuthService } from './AuthService';

function createMockHttpClient(postMock = vi.fn()): HttpClient {
  return {
    get: vi.fn(),
    post: postMock,
    put: vi.fn(),
    delete: vi.fn(),
  };
}

describe('AuthService', () => {
  describe('login', () => {
    it('returns login payload on success', async () => {
      const mockResult = {
        accessToken: 'mock-jwt-token',
        tokenType: 'Bearer',
        user: { id: 'u-1', email: 'user@example.com' },
      };
      const post = vi.fn().mockResolvedValue({
        data: { login: mockResult },
      });
      const service = new AuthService(createMockHttpClient(post));

      const result = await service.login({ email: 'user@example.com', password: 'password123' });

      expect(result).toEqual(mockResult);
      expect(post).toHaveBeenCalledWith(
        '/graphql',
        expect.objectContaining({
          variables: { input: { email: 'user@example.com', password: 'password123' } },
        }),
      );
    });

    it('throws AuthError when backend returns errors', async () => {
      const post = vi.fn().mockResolvedValue({
        errors: [{ message: 'Invalid email or password.', extensions: { code: 'INVALID_CREDENTIALS' } }],
      });
      const service = new AuthService(createMockHttpClient(post));

      await expect(
        service.login({ email: 'wrong@example.com', password: 'wrong' }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('logout', () => {
    it('executes logout mutation and handles errors gracefully', async () => {
      const post = vi.fn().mockResolvedValue({ data: { logout: true } });
      const service = new AuthService(createMockHttpClient(post));

      await expect(service.logout()).resolves.toBeUndefined();
      expect(post).toHaveBeenCalledWith('/graphql', expect.objectContaining({ query: expect.stringContaining('logout') }));
    });
  });

  describe('me', () => {
    it('returns current user when token is valid', async () => {
      const post = vi.fn().mockResolvedValue({
        data: { me: { id: 'u-1', email: 'user@example.com' } },
      });
      const service = new AuthService(createMockHttpClient(post));

      const user = await service.me();
      expect(user).toEqual({ id: 'u-1', email: 'user@example.com' });
    });

    it('returns null when query returns errors or fails', async () => {
      const post = vi.fn().mockResolvedValue({
        errors: [{ message: 'Unauthenticated' }],
      });
      const service = new AuthService(createMockHttpClient(post));

      const user = await service.me();
      expect(user).toBeNull();
    });
  });

  describe('getProjects', () => {
    it('returns user projects on success', async () => {
      const mockProjects = [
        {
          id: 'p-1',
          key: 'TES',
          name: 'Test Project',
          role: 'OWNER',
          boards: [{ id: 'b-1', name: 'Board 1' }],
        },
      ];
      const post = vi.fn().mockResolvedValue({
        data: { projects: mockProjects },
      });
      const service = new AuthService(createMockHttpClient(post));

      const result = await service.getProjects('u-1');
      expect(result).toEqual(mockProjects);
    });
  });
});
