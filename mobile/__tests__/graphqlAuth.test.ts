import { GraphQLResponseError, graphqlRequest } from '../src/api/graphql';
import { setSession, setUnauthenticatedHandler } from '../src/auth/session';
import { ACCESS_TOKEN, API_URL, gqlError, mockFetch, signInAs } from '../test-utils/fakeBackend';

const QUERY = 'query { me { id } }';
const refused = () => ({ body: gqlError('AUTH_NOT_AUTHENTICATED', 'The current user is not authorized to access this resource.') });
const authorization = (fetchMock: jest.Mock) =>
  ((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization');

const onUnauthenticated = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
  onUnauthenticated.mockClear();
  setUnauthenticatedHandler(onUnauthenticated);
});

afterAll(() => setUnauthenticatedHandler(null));

describe('GraphQL requests and the session token', () => {
  it('sends no Authorization header when nobody is signed in', async () => {
    const fetchMock = mockFetch({ body: { data: { me: null } } });
    await graphqlRequest(QUERY);
    expect(authorization(fetchMock)).toBeNull();
  });

  it('sends the signed-in session’s token as a Bearer token', async () => {
    signInAs();
    const fetchMock = mockFetch({ body: { data: { me: { id: '1' } } } });
    await graphqlRequest(QUERY);
    expect(authorization(fetchMock)).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('reports a refused session token so the app can sign out', async () => {
    signInAs();
    mockFetch(refused());
    await expect(graphqlRequest(QUERY)).rejects.toBeInstanceOf(GraphQLResponseError);
    expect(onUnauthenticated).toHaveBeenCalledWith(ACCESS_TOKEN);
  });

  it('reports a refusal sent with HTTP 401 too', async () => {
    signInAs();
    mockFetch({ status: 401, ...refused() });
    await expect(graphqlRequest(QUERY)).rejects.toBeInstanceOf(GraphQLResponseError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('does not sign out a newer session when an old token’s refusal arrives late', async () => {
    signInAs(undefined, 'old-token');
    let answer!: (value: unknown) => void;
    globalThis.fetch = jest.fn(() => new Promise((resolve) => (answer = resolve))) as unknown as typeof fetch;
    const pending = graphqlRequest(QUERY);

    signInAs(undefined, 'new-token');
    answer({ ok: true, status: 200, text: async () => JSON.stringify(refused().body) });

    await expect(pending).rejects.toBeInstanceOf(GraphQLResponseError);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('sends exactly the given token, and leaves a refusal to the caller, for the auth operations', async () => {
    signInAs();
    const fetchMock = mockFetch(refused());
    await expect(graphqlRequest(QUERY, undefined, { accessToken: 'checked-token' })).rejects.toBeInstanceOf(
      GraphQLResponseError,
    );
    expect(authorization(fetchMock)).toBe('Bearer checked-token');
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('can send a request without any token, as login and registration do', async () => {
    signInAs();
    const fetchMock = mockFetch({ body: { data: { me: null } } });
    await graphqlRequest(QUERY, undefined, { accessToken: null });
    expect(authorization(fetchMock)).toBeNull();
  });
});
