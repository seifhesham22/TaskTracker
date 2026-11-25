import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { ProjectAccessClassifier } from './projectAccess';

describe('ProjectAccessClassifier', () => {
  const classifier = new ProjectAccessClassifier();

  it('returns permitted when error is null or undefined', () => {
    expect(classifier.classifyError(null)).toBe('permitted');
    expect(classifier.classifyError(undefined)).toBe('permitted');
  });

  it('classifies 401 as session_expired', () => {
    const error = new ApiError('Unauthorized', 401, null);
    expect(classifier.classifyError(error)).toBe('session_expired');
  });

  it('classifies AUTH_NOT_AUTHENTICATED GraphQL extension as session_expired', () => {
    const error = new ApiError('Session expired', 400, [
      { message: 'Not authenticated', extensions: { code: 'AUTH_NOT_AUTHENTICATED' } },
    ]);
    expect(classifier.classifyError(error)).toBe('session_expired');
  });

  it('classifies 403 on initial direct link load as unavailable (State 03)', () => {
    const error = new ApiError('Forbidden', 403, null);
    expect(classifier.classifyError(error, false)).toBe('unavailable');
  });

  it('classifies 403 when user was previously permitted as revoked (State 04)', () => {
    const error = new ApiError('Forbidden', 403, null);
    expect(classifier.classifyError(error, true)).toBe('revoked');
  });

  it('classifies AUTH_NOT_AUTHORIZED GraphQL extension as unavailable or revoked based on prior access', () => {
    const error = new ApiError('Access denied', 400, [
      { message: 'You do not have access', extensions: { code: 'AUTH_NOT_AUTHORIZED' } },
    ]);
    expect(classifier.classifyError(error, false)).toBe('unavailable');
    expect(classifier.classifyError(error, true)).toBe('revoked');
  });

  it('classifies 404 / NOT_FOUND as unavailable (State 03)', () => {
    const notFoundError = new ApiError('Board was not found', 404, null);
    expect(classifier.classifyError(notFoundError)).toBe('unavailable');

    const graphQlNotFound = new ApiError('Not found', 400, [
      { message: 'Project not found', extensions: { code: 'NOT_FOUND' } },
    ]);
    expect(classifier.classifyError(graphQlNotFound)).toBe('unavailable');
  });

  it('classifies network / fetch failures as connection_error (State 06)', () => {
    const fetchError = new TypeError('Failed to fetch');
    expect(classifier.classifyError(fetchError)).toBe('connection_error');

    const networkError = new Error('Network request failed');
    expect(classifier.classifyError(networkError)).toBe('connection_error');

    const status0 = new ApiError('Connection error', 0, null);
    expect(classifier.classifyError(status0)).toBe('connection_error');

    const status503 = new ApiError('Service Unavailable', 503, null);
    expect(classifier.classifyError(status503)).toBe('connection_error');
  });
});
