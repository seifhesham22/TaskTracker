import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { defaultTokenStorage } from '../auth/TokenStorage';

beforeEach(() => {
  defaultTokenStorage.setToken('test-mock-token');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
