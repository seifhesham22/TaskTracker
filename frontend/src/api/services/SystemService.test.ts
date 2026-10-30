import { describe, expect, it, vi } from 'vitest';
import { ApiConfigurationError, ApiError } from '../errors';
import type { HttpClient } from '../HttpClient';
import { SystemService } from './SystemService';

function httpClientRejectingWith(error: unknown): HttpClient {
  return {
    get: vi.fn().mockRejectedValue(error),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

describe('SystemService.checkStatus', () => {
  it('is online when the backend answers successfully', async () => {
    const http: HttpClient = { ...httpClientRejectingWith(null), get: vi.fn().mockResolvedValue({}) };
    expect(await new SystemService(http).checkStatus()).toBe('online');
  });

  it('is online when the backend answers with an HTTP error', async () => {
    const http = httpClientRejectingWith(new ApiError('Not found', 404, undefined));
    expect(await new SystemService(http).checkStatus()).toBe('online');
  });

  it('is unconfigured when VITE_API_URL is missing', async () => {
    const http = httpClientRejectingWith(new ApiConfigurationError());
    expect(await new SystemService(http).checkStatus()).toBe('unconfigured');
  });

  it('is offline when the request fails at the network level', async () => {
    const http = httpClientRejectingWith(new TypeError('Failed to fetch'));
    expect(await new SystemService(http).checkStatus()).toBe('offline');
  });
});
