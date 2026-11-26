import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { BackHandler } from 'react-native';

import { PROJECTS_QUERY, type ProjectNode } from '../src/api/boards';
import { CREATE_PROJECT_MUTATION } from '../src/api/projects';
import { setSession } from '../src/auth/session';
import {
  CREATE_PROJECT_FAILED,
  PROJECT_CREATED,
  PROJECT_NAME_REQUIRED,
  PROJECTS_REFRESH_FAILED,
} from '../src/domain/createProject';
import {
  ACCESS_TOKEN,
  API_URL,
  type FakeResponse,
  gqlError,
  mockFetch,
  projectsResponse,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const project = (id: string, name: string, role = 'OWNER'): ProjectNode => ({
  id,
  name,
  description: null,
  role,
  boards: [{ id: `${id}-board`, name: 'Board' }],
  projectMembers: [],
});
const LAUNCH = project('p-launch', 'Product launch', 'WRITER');
const REDESIGN = project('p-redesign', 'Website redesign');

const list = (...projects: ProjectNode[]) => projectsResponse(projects);
const createdResponse = (node: ProjectNode = REDESIGN) => ({ body: { data: { createProject: node } } });

type Sent = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const createCalls = (fetchMock: jest.Mock) => sent(fetchMock).filter((b) => b.query === CREATE_PROJECT_MUTATION);
const listCalls = (fetchMock: jest.Mock) => sent(fetchMock).filter((b) => b.query === PROJECTS_QUERY);

async function openList(...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp('/');
  await screen.findByTestId('create-project-button');
  return { router, fetchMock };
}

/** The list (showing Product launch), then Create project. The form reads the list once before it creates. */
async function openForm(...responses: FakeResponse[]) {
  const opened = await openList(list(LAUNCH), ...responses);
  await fireEvent.press(screen.getByTestId('create-project-button'));
  await screen.findByTestId('project-name-input');
  return opened;
}

const type = (name: string) => fireEvent.changeText(screen.getByTestId('project-name-input'), name);
const submit = () => fireEvent.press(screen.getByTestId('create-project-submit'));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Create project on the project list', () => {
  it('is offered under the projects, which show the user’s role', async () => {
    await openList(list(LAUNCH, REDESIGN));

    expect(screen.getByRole('button', { name: 'Create project' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('project-p-redesign')).getByText('Owner · Private project')).toBeOnTheScreen();
    expect(within(screen.getByTestId('project-p-launch')).getByText('Writer · Private project')).toBeOnTheScreen();
  });

  it('is offered for the first project when there are none', async () => {
    await openList(list());

    expect(screen.getByText('No projects yet. Create your first project to get started.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create project' })).toBeOnTheScreen();
  });

  it('can’t be opened by link when signed out', async () => {
    resetSecureStore();
    mockFetch();
    const router = await renderApp('/projects/new');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(router).toHavePathname('/login');
  });
});

describe('Create a project form', () => {
  it('renders the design and takes a name', async () => {
    const { router, fetchMock } = await openForm();

    expect(router).toHavePathname('/projects/new');
    expect(screen.getByRole('header', { name: 'Create a project' })).toBeOnTheScreen();
    expect(screen.getByText('Give your team a shared workspace.')).toBeOnTheScreen();
    expect(screen.getByText('Project name *')).toBeOnTheScreen();
    expect(screen.getByText('Required field. You will become this project’s Owner.')).toBeOnTheScreen();
    expect(screen.getByTestId('project-name-input').props.autoFocus).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();

    await type('Website redesign');
    expect(screen.getByTestId('project-name-input').props.value).toBe('Website redesign');
    expect(createCalls(fetchMock)).toHaveLength(0);
  });

  it.each(['', '   ', '\t\n '])('rejects the empty name %j, keeps it and sends nothing', async (name) => {
    const { router, fetchMock } = await openForm();
    const before = fetchMock.mock.calls.length;

    await type(name);
    await submit();

    expect(screen.getByTestId('project-name-error')).toHaveTextContent(PROJECT_NAME_REQUIRED);
    expect(screen.getByTestId('project-name-input').props.value).toBe(name);
    expect(router).toHavePathname('/projects/new');
    expect(fetchMock).toHaveBeenCalledTimes(before);

    await type('Website');
    expect(screen.queryByTestId('project-name-error')).not.toBeOnTheScreen();
  });

  it('creates the project with the trimmed name and shows it in the list read again from the backend', async () => {
    const { router, fetchMock } = await openForm(
      list(LAUNCH),
      createdResponse(),
      list(LAUNCH, REDESIGN),
      list(LAUNCH, REDESIGN),
    );

    await type('  Website redesign  ');
    await submit();

    expect(await screen.findByText(PROJECT_CREATED)).toBeOnTheScreen();
    expect(router).toHavePathname('/');
    const card = await screen.findByTestId('project-p-redesign');
    expect(within(card).getByText('Website redesign')).toBeOnTheScreen();
    expect(within(card).getByText('Owner · Private project')).toBeOnTheScreen();
    expect(screen.getByTestId('project-p-launch')).toBeOnTheScreen();

    // Only the name is sent: the backend takes the owner from the token.
    expect(createCalls(fetchMock).map((c) => c.variables)).toEqual([{ input: { name: 'Website redesign' } }]);
    const index = sent(fetchMock).findIndex((b) => b.query === CREATE_PROJECT_MUTATION);
    expect(((fetchMock.mock.calls[index][1] as RequestInit).headers as Headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    expect(sent(fetchMock)[index + 1].query).toBe(PROJECTS_QUERY);

    await fireEvent.press(within(card).getByRole('button', { name: 'Open Website redesign' }));
    await waitFor(() => expect(router).toHavePathname('/boards'));
    expect(await screen.findByText('Board')).toBeOnTheScreen();
  });

  it('says so if the list can’t be refreshed after creating, keeps the projects, and can try again', async () => {
    await openForm(list(LAUNCH), createdResponse(), 'network-error', list(LAUNCH, REDESIGN));

    await type('Website redesign');
    await submit();

    expect(await screen.findByTestId('projects-refresh-error')).toHaveTextContent(PROJECTS_REFRESH_FAILED);
    expect(screen.getByText(PROJECT_CREATED)).toBeOnTheScreen();
    expect(screen.getByTestId('project-p-launch')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-p-redesign')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('projects-refresh'));
    expect(await screen.findByTestId('project-p-redesign')).toBeOnTheScreen();
    expect(screen.queryByTestId('projects-refresh-error')).not.toBeOnTheScreen();
  });

  it('shows “Creating…”, locks the form and Back, and sends one request however often it is tapped', async () => {
    const onBack = jest.spyOn(BackHandler, 'addEventListener');
    await openForm();
    await type('Website redesign');
    let answer!: (value: unknown) => void;
    const response = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const fetchMock = jest.fn((_url: string, init: RequestInit) =>
      JSON.parse(init.body as string).query === CREATE_PROJECT_MUTATION
        ? new Promise((resolve) => (answer = resolve))
        : Promise.resolve(response(list(LAUNCH).body)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    onBack.mockClear();

    await submit();
    await submit();
    await fireEvent(screen.getByTestId('project-name-input'), 'submitEditing');

    expect(screen.getByText('Creating…')).toBeOnTheScreen();
    expect(screen.getByTestId('create-project-submit')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('project-name-input').props.editable).toBe(false);
    expect(onBack.mock.calls.some(([event, handler]) => event === 'hardwareBackPress' && (handler as () => unknown)() === true)).toBe(true);
    await waitFor(() => expect(createCalls(fetchMock)).toHaveLength(1));
    expect(screen.queryByText(PROJECT_CREATED)).not.toBeOnTheScreen();

    mockFetch(list(LAUNCH, REDESIGN));
    await act(async () => answer(response(createdResponse().body)));
    expect(await screen.findByText(PROJECT_CREATED)).toBeOnTheScreen();
    onBack.mockRestore();
  });

  it.each([
    ['Project name cannot be empty or only spaces.', PROJECT_NAME_REQUIRED],
    ['Project name cannot be longer than 100 characters.', 'Project name cannot be longer than 100 characters.'],
  ])('shows the backend’s “%s” under the name, which can be corrected', async (message, shown) => {
    const { fetchMock } = await openForm(
      list(LAUNCH),
      { body: gqlError('BAD_USER_INPUT', message) },
      createdResponse(),
      list(LAUNCH, REDESIGN),
    );
    await type('Some name');
    await submit();

    expect(await screen.findByTestId('project-name-error')).toHaveTextContent(shown);
    expect(screen.getByTestId('project-name-input').props.value).toBe('Some name');
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();

    await type('Website redesign');
    await submit();
    expect(await screen.findByText(PROJECT_CREATED)).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(2);
  });

  it('shows any other backend refusal above the buttons', async () => {
    const message = "The key 'WEBS' is already used by another project.";
    await openForm(list(LAUNCH), { body: gqlError('BAD_USER_INPUT', message) });
    await type('Website redesign');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
  });

  it('Cancel goes back to the list without creating anything', async () => {
    const { router, fetchMock } = await openForm(list(LAUNCH));
    await type('Not wanted');

    await fireEvent.press(screen.getByTestId('cancel-button'));

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(createCalls(fetchMock)).toHaveLength(0);
    expect(screen.queryByText(PROJECT_CREATED)).not.toBeOnTheScreen();
  });
});

describe('Retrying after a failure', () => {
  const failures: [string, FakeResponse][] = [
    ['no response', 'network-error'],
    ['a server error', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }],
  ];

  it.each(failures)('keeps the name after %s, and creates the project if it isn’t there yet', async (_, failure) => {
    const { router, fetchMock } = await openForm(
      list(LAUNCH),
      failure,
      list(LAUNCH),
      createdResponse(),
      list(LAUNCH, REDESIGN),
    );
    await type('Website redesign');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(CREATE_PROJECT_FAILED);
    expect(router).toHavePathname('/projects/new');
    expect(screen.getByTestId('project-name-input').props.value).toBe('Website redesign');
    expect(screen.getByTestId('cancel-button')).toBeEnabled();

    await submit();
    expect(await screen.findByText(PROJECT_CREATED)).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(2);
  });

  it.each(failures)('doesn’t create it twice when the first attempt was saved despite %s', async (_, failure) => {
    const { fetchMock } = await openForm(list(LAUNCH), failure, list(LAUNCH, REDESIGN), list(LAUNCH, REDESIGN));
    await type('Website redesign');
    await submit();
    await screen.findByTestId('form-error');

    await submit();

    expect(await screen.findByText(PROJECT_CREATED)).toBeOnTheScreen();
    expect(await screen.findByTestId('project-p-redesign')).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(1);
  });

  it('doesn’t mistake an older project of the same name for the new one', async () => {
    const second = project('p-second', 'Website redesign');
    const { fetchMock } = await openForm(
      list(LAUNCH, REDESIGN),
      'network-error',
      list(LAUNCH, REDESIGN),
      createdResponse(second),
      list(LAUNCH, REDESIGN, second),
    );
    await type('Website redesign');
    await submit();
    await screen.findByTestId('form-error');
    await submit();

    expect(await screen.findByTestId('project-p-second')).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(2);
  });

  it('sends nothing while it can’t rule out a duplicate', async () => {
    const { fetchMock } = await openForm(list(LAUNCH), 'network-error', 'network-error');
    await type('Website redesign');
    await submit();
    await screen.findByTestId('form-error');
    await submit();

    await waitFor(() => expect(listCalls(fetchMock)).toHaveLength(3));
    expect(await screen.findByTestId('form-error')).toHaveTextContent(CREATE_PROJECT_FAILED);
    expect(createCalls(fetchMock)).toHaveLength(1);
  });
});
