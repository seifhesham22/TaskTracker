import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { LinkNode, TaskNode } from '../src/api/boards';
import { ADD_TASK_DEPENDENCY_MUTATION, SEARCH_TASKS_QUERY } from '../src/api/dependencies';
import { setSession } from '../src/auth/session';
import { ADD_FAILED, SEARCH_FAILED, SELECT_A_TASK, looksLikeKey, matchingTasks } from '../src/domain/dependencies';
import {
  API_URL,
  BOARD_ID,
  COLUMNS,
  PROJECT_ID,
  PROJECTS,
  type FakeResponse,
  boardResponse,
  gqlError,
  mockFetch,
  projectsResponse,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const CURRENT_ID = '01a18766-8315-7c9c-90fd-5657de973424';
const SCOPE_ID = '01a18766-8315-7c9c-90fd-5657de973418';
const DOCS_ID = '01a18766-8315-7c9c-90fd-5657de973419';

const link = (id: string, readableId: string, title: string, column = 2): LinkNode => ({
  id,
  readableId,
  title,
  status: COLUMNS[column].category,
  boardId: BOARD_ID,
  column: { name: COLUMNS[column].name },
});
const CURRENT = link(CURRENT_ID, 'TES-24', 'Prepare the project launch');
const SCOPE = link(SCOPE_ID, 'TES-18', 'Approve project scope');
const DOCS = link(DOCS_ID, 'TES-19', 'Write the launch docs', 1);

const asTask = (l: LinkNode, overrides: Partial<TaskNode> = {}): TaskNode =>
  taskNode({
    id: l.id,
    readableId: l.readableId,
    number: Number(l.readableId.split('-')[1]),
    title: l.title,
    description: null,
    priority: null,
    dueDate: null,
    assignees: [],
    columnId: COLUMNS[2].id,
    status: l.status,
    column: { id: COLUMNS[2].id, name: l.column.name, category: l.status },
    blockedBy: [],
    blocks: [],
    ...overrides,
  });

/** The board as the backend returns it; \`linked\` adds “TES-18 must happen before TES-24”. */
const read = (linked = false, projects = PROJECTS): FakeResponse[] => [
  boardResponse([
    asTask(CURRENT, { blockedBy: linked ? [SCOPE] : [] }),
    asTask(SCOPE, { blocks: linked ? [CURRENT] : [] }),
    asTask(DOCS),
  ]),
  projectsResponse(projects),
];
const found = (...items: LinkNode[]) => ({ body: { data: { backlog: { items } } } });
const added = (blocking: LinkNode, blocked: LinkNode) => ({
  body: { data: { addTaskDependency: { blockingTask: blocking, blockedTask: blocked } } },
});

type Sent = { query: string; variables: Record<string, unknown> & { input?: Record<string, unknown> } };
const bodies = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const addCalls = (fetchMock: jest.Mock) => bodies(fetchMock).filter((b) => b.query === ADD_TASK_DEPENDENCY_MUTATION);
const searchCalls = (fetchMock: jest.Mock) => bodies(fetchMock).filter((b) => b.query === SEARCH_TASKS_QUERY);

async function open(url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url);
  return { router, fetchMock };
}

const dependenciesUrl = (id = CURRENT_ID) => `/tasks/${id}/dependencies?boardId=${BOARD_ID}`;

/** The dependencies screen of TES-24, then Add dependency with the first search answered. */
async function openAddForm(search: FakeResponse, ...after: FakeResponse[]) {
  const opened = await open(dependenciesUrl(), ...read(), search, ...after);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add dependency' }));
  await screen.findByTestId('search-results');
  return opened;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Seeing dependencies', () => {
  it('opens from task details, which says when there are none', async () => {
    const { router } = await open(`/tasks/${CURRENT_ID}?boardId=${BOARD_ID}`, ...read(), ...read());

    const section = await screen.findByTestId('dependencies-summary');
    expect(within(section).getByText('No dependencies yet.')).toBeOnTheScreen();
    await fireEvent.press(within(section).getByRole('button', { name: 'Dependencies' }));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${CURRENT_ID}/dependencies`));
    expect(await screen.findByTestId('no-dependencies')).toBeOnTheScreen();
    expect(screen.getByText('Task dependencies')).toBeOnTheScreen();
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent('TEST PROJECT / TES-24');
    expect(screen.getByRole('button', { name: 'Add dependency' })).toBeOnTheScreen();
  });

  it('shows the predecessor of a task that is blocked: TES-18 must happen before TES-24', async () => {
    await open(dependenciesUrl(), ...read(true));

    expect(await screen.findByText('Blocked by · 1 task')).toBeOnTheScreen();
    const card = screen.getByTestId(`dependency-${SCOPE_ID}`);
    expect(within(card).getByText('TES-18 · In progress')).toBeOnTheScreen();
    expect(within(card).getByText('Approve project scope')).toBeOnTheScreen();
    expect(screen.getByTestId(`relation-${SCOPE_ID}`).props.accessibilityLabel).toBe(
      'TES-18 Approve project scope must happen before TES-24 Prepare the project launch',
    );
    expect(screen.queryByText(/^Blocks ·/)).not.toBeOnTheScreen();
  });

  it('shows the same relationship from the other task, as a dependent, in the same direction', async () => {
    await open(dependenciesUrl(SCOPE_ID), ...read(true));

    expect(await screen.findByText('Blocks · 1 task')).toBeOnTheScreen();
    expect(screen.getByTestId(`relation-${CURRENT_ID}`).props.accessibilityLabel).toBe(
      'TES-18 Approve project scope must happen before TES-24 Prepare the project launch',
    );
    expect(screen.queryByText(/^Blocked by ·/)).not.toBeOnTheScreen();
  });

  it('lists the relationship in task details too, and opens the other task from the list', async () => {
    const { router } = await open(`/tasks/${CURRENT_ID}?boardId=${BOARD_ID}`, ...read(true), ...read(true), ...read(true));

    expect(await screen.findByText('Blocked by · 1 task')).toBeOnTheScreen();
    expect(screen.getByTestId(`details-relation-${SCOPE_ID}`).props.accessibilityLabel).toMatch(/^TES-18 .* must happen before TES-24/);

    await fireEvent.press(screen.getByTestId('dependencies-button'));
    await fireEvent.press(await screen.findByTestId(`dependency-${SCOPE_ID}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${SCOPE_ID}`));
    expect(await screen.findByText('Blocks · 1 task')).toBeOnTheScreen();
  });
});

describe('Adding a dependency', () => {
  it('searches the project, shows loading, then lets the manager pick another task and adds “TES-18 blocks TES-24”', async () => {
    resetSecureStore(storedSession());
    let answerSearch!: (value: unknown) => void;
    const queue: (() => Promise<unknown>)[] = [
      ...[meResponse(), ...read()].map((r) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify((r as { body: unknown }).body) })),
      () => new Promise((resolve) => (answerSearch = resolve)),
    ];
    const first = jest.fn(() => queue.shift()!());
    globalThis.fetch = first as unknown as typeof fetch;
    await renderApp(dependenciesUrl());
    await fireEvent.press(await screen.findByRole('button', { name: 'Add dependency' }));

    expect(screen.getByTestId('current-task')).toHaveTextContent('CURRENT TASK · TES-24 Prepare the project launch');
    expect(screen.getByTestId('relationship-select')).toHaveTextContent('Blocked by');
    expect(screen.getByTestId('relationship-hint')).toHaveTextContent('The selected task must finish before TES-24.');
    expect(screen.getByPlaceholderText('Search by title or task key')).toBeOnTheScreen();
    expect(await screen.findByText('Loading matching tasks…')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-dependency')).toBeDisabled();
    expect(screen.getByText('Loading…')).toBeOnTheScreen();

    // The search goes out once typing has paused. The backend returns the current task too; it can't be picked.
    await waitFor(() => expect(first).toHaveBeenCalledTimes(4));
    const fetchMock = mockFetch(added(SCOPE, CURRENT), ...read(true));
    answerSearch({ ok: true, status: 200, text: async () => JSON.stringify(found(CURRENT, SCOPE, DOCS).body) });
    const results = await screen.findByTestId('search-results');
    expect(within(results).queryByText('Prepare the project launch')).not.toBeOnTheScreen();
    expect(within(results).getAllByRole('button')).toHaveLength(2);
    const searched = JSON.parse((first.mock.calls[3] as unknown as [string, RequestInit])[1].body as string);
    expect(searched.variables).toEqual({ projectId: PROJECT_ID, search: null, pageSize: 20 });

    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    expect(screen.getByTestId(`selected-${SCOPE_ID}`)).toBeOnTheScreen();
    expect(screen.getByTestId('relation-preview').props.accessibilityLabel).toBe(
      'TES-18 Approve project scope must happen before TES-24 Prepare the project launch',
    );
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(await screen.findByText('Dependency added')).toBeOnTheScreen();
    expect(addCalls(fetchMock)[0].variables.input).toEqual({ blockingTaskId: SCOPE_ID, blockedTaskId: CURRENT_ID });
    // Shown as the backend now has it, after reading the task again.
    expect(await screen.findByText('Blocked by · 1 task')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add another dependency' })).toBeOnTheScreen();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it('sends the other direction for “Blocks”: TES-24 must happen before the selected task', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE, DOCS), added(CURRENT, DOCS), ...read());

    await fireEvent.press(screen.getByTestId('relationship-select'));
    await fireEvent.press(within(screen.getByTestId('relationship-sheet')).getByRole('button', { name: /^Blocks/ }));
    expect(screen.getByTestId('relationship-hint')).toHaveTextContent('TES-24 must finish before the selected task.');
    await fireEvent.press(screen.getByTestId(`result-${DOCS_ID}`));
    expect(screen.getByTestId('relation-preview').props.accessibilityLabel).toBe(
      'TES-24 Prepare the project launch must happen before TES-19 Write the launch docs',
    );
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    await screen.findByText('Dependency added');
    expect(addCalls(fetchMock)[0].variables.input).toEqual({ blockingTaskId: CURRENT_ID, blockedTaskId: DOCS_ID });
  });

  it('searches titles on the backend and keys by reading the project’s tasks', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE, DOCS), found(SCOPE), found(CURRENT, SCOPE, DOCS));

    await fireEvent.changeText(screen.getByTestId('task-search-input'), 'Approve');
    await waitFor(() => expect(searchCalls(fetchMock)).toHaveLength(2));
    expect(searchCalls(fetchMock)[1].variables).toEqual({ projectId: PROJECT_ID, search: 'Approve', pageSize: 20 });
    expect(await within(await screen.findByTestId('search-results')).findByText('Approve project scope')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('task-search-input'), 'tes-19');
    await waitFor(() => expect(searchCalls(fetchMock)).toHaveLength(3));
    expect(searchCalls(fetchMock)[2].variables).toEqual({ projectId: PROJECT_ID, search: null, pageSize: 100 });
    await waitFor(() =>
      expect(within(screen.getByTestId('search-results')).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
        'TES-19, To do, Write the launch docs',
      ]),
    );
  });

  it('asks for a task before adding, and sends nothing', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE, DOCS));

    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(screen.getByTestId('task-search-error')).toHaveTextContent(SELECT_A_TASK);
    expect(addCalls(fetchMock)).toHaveLength(0);
  });

  it('marks a task that is already linked this way, so no duplicate can be picked', async () => {
    const { fetchMock } = await open(dependenciesUrl(), ...read(true), found(SCOPE, DOCS));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add dependency' }));

    const already = await screen.findByTestId(`result-${SCOPE_ID}`);
    expect(already).toBeDisabled();
    expect(within(already).getByText('TES-18 · In progress · Already linked')).toBeOnTheScreen();
    expect(screen.getByTestId(`result-${DOCS_ID}`)).toBeEnabled();
    expect(addCalls(fetchMock)).toHaveLength(0);
  });

  it.each([
    ['different projects', 'TES-24 and OTH-3 are in different projects. A task can only block a task of the same project.'],
    // A cycle gets its own view (US-18): see dependencyCycle.test.tsx.
    ['a task blocking itself', 'A task can\'t block itself.'],
  ])('shows the backend’s refusal for %s, keeps the selection, and adds nothing', async (_, message) => {
    await openAddForm(found(SCOPE, DOCS), { body: gqlError('BAD_USER_INPUT', message) });

    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(screen.getByTestId(`selected-${SCOPE_ID}`)).toBeOnTheScreen();
    expect(screen.getByTestId('relationship-select')).toHaveTextContent('Blocked by');
    expect(screen.queryByText('Dependency added')).not.toBeOnTheScreen();
  });

  it('shows the backend’s permission refusal', async () => {
    const message = 'Only writers and owners of the project can add dependencies.';
    await openAddForm(found(SCOPE), { body: gqlError('AUTH_NOT_AUTHORIZED', message) });

    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
  });

  it('keeps everything after a network failure, and can try again', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE), 'network-error', added(SCOPE, CURRENT), ...read(true));

    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(ADD_FAILED);
    expect(screen.getByTestId(`selected-${SCOPE_ID}`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('submit-dependency'));
    expect(await screen.findByText('Dependency added')).toBeOnTheScreen();
    expect(addCalls(fetchMock)).toHaveLength(2);
  });

  it('shows “Adding…” and sends one request however often it is tapped', async () => {
    await openAddForm(found(SCOPE));
    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    let answer!: (value: unknown) => void;
    const pending = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = pending as unknown as typeof fetch;

    await fireEvent.press(screen.getByTestId('submit-dependency'));
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-dependency')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeOnTheScreen();
    expect(screen.queryByText('Dependency added')).not.toBeOnTheScreen();
    expect(pending).toHaveBeenCalledTimes(1);

    mockFetch(...read(true));
    answer({ ok: true, status: 200, text: async () => JSON.stringify(added(SCOPE, CURRENT).body) });
    expect(await screen.findByText('Dependency added')).toBeOnTheScreen();
  });

  it('Cancel returns to the unchanged list without adding anything', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE));
    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByTestId('no-dependencies')).toBeOnTheScreen();
    expect(addCalls(fetchMock)).toHaveLength(0);
  });

  it('says when nothing matches, and when the search fails offers to try again', async () => {
    const { fetchMock } = await openAddForm(found(SCOPE), found(CURRENT), 'network-error', found(DOCS));

    await fireEvent.changeText(screen.getByTestId('task-search-input'), 'Prepare');
    expect(await screen.findByTestId('search-empty')).toHaveTextContent('No other tasks in this project match “Prepare”.');

    await fireEvent.changeText(screen.getByTestId('task-search-input'), 'Write');
    expect(await screen.findByTestId('search-error')).toHaveTextContent(SEARCH_FAILED);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId(`result-${DOCS_ID}`)).toBeOnTheScreen();
    expect(searchCalls(fetchMock)).toHaveLength(4);
  });

  it('doesn’t offer adding to a reader of the project', async () => {
    const readerProjects = PROJECTS.map((p) => (p.id === PROJECT_ID ? { ...p, role: 'READER' } : p));
    await open(dependenciesUrl(), ...read(false, readerProjects));

    expect(await screen.findByTestId('read-only-note')).toHaveTextContent('Only the project’s writers and owners can add dependencies.');
    expect(screen.queryByRole('button', { name: 'Add dependency' })).not.toBeOnTheScreen();
  });

  it('still shows the new relationship after the other task is opened and the screen read again', async () => {
    const { router } = await openAddForm(found(SCOPE), added(SCOPE, CURRENT), ...read(true), ...read(true), ...read(true));
    await fireEvent.press(screen.getByTestId(`result-${SCOPE_ID}`));
    await fireEvent.press(screen.getByTestId('submit-dependency'));
    await screen.findByText('Dependency added');

    await fireEvent.press(await screen.findByTestId(`dependency-${SCOPE_ID}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${SCOPE_ID}`));
    expect(await screen.findByText('Blocks · 1 task')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('close-button'));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${CURRENT_ID}/dependencies`));
    expect(await screen.findByText('Blocked by · 1 task')).toBeOnTheScreen();
  });
});

describe('Matching tasks', () => {
  it('never offers the current task, and matches keys and titles', () => {
    const links = [CURRENT, SCOPE, DOCS].map((l) => ({ ...l, status: l.status, columnName: l.column.name }));
    expect(matchingTasks(links, '', CURRENT_ID).map((l) => l.readableId)).toEqual(['TES-18', 'TES-19']);
    expect(matchingTasks(links, '18', CURRENT_ID).map((l) => l.readableId)).toEqual(['TES-18']);
    expect(matchingTasks(links, 'TES-24', CURRENT_ID)).toEqual([]);
    expect(matchingTasks(links, 'launch', CURRENT_ID).map((l) => l.readableId)).toEqual(['TES-19']);
    expect([looksLikeKey('TES-18'), looksLikeKey('18'), looksLikeKey('Approve')]).toEqual([true, true, false]);
  });
});
