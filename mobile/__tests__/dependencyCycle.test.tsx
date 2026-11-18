import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { LinkNode, TaskNode } from '../src/api/boards';
import { ADD_TASK_DEPENDENCY_MUTATION } from '../src/api/dependencies';
import { GraphQLResponseError, NetworkError } from '../src/api/graphql';
import { setSession } from '../src/auth/session';
import { ADD_FAILED, CYCLE_TITLE, toCycleInfo } from '../src/domain/dependencies';
import {
  API_URL,
  BOARD_ID,
  COLUMNS,
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

const id = (n: number) => `01a18766-8315-7c9c-90fd-5657de9734${String(n).padStart(2, '0')}`;
const link = (n: number, title: string, column = 1): LinkNode => ({
  id: id(n),
  readableId: `TES-${n}`,
  title,
  status: COLUMNS[column].category,
  boardId: BOARD_ID,
  column: { name: COLUMNS[column].name },
});
const CURRENT = link(24, 'Prepare the project launch', 2);
const RELEASE = link(27, 'Publish release notes');
const SCOPE = link(18, 'Approve project scope', 2);
const VENUE = link(30, 'Book the venue', 3);

const asTask = (l: LinkNode, blockedBy: LinkNode[] = [], blocks: LinkNode[] = []): TaskNode =>
  taskNode({
    id: l.id,
    readableId: l.readableId,
    number: Number(l.readableId.split('-')[1]),
    title: l.title,
    description: null,
    priority: null,
    dueDate: null,
    assignees: [],
    status: l.status,
    column: { id: COLUMNS[1].id, name: l.column.name, category: l.status },
    blockedBy,
    blocks,
  });

/**
 * What the backend has: TES-24 blocks TES-27 and is blocked by TES-30 (both valid). With
 * \`withScope\`, also TES-18 blocks TES-24.
 */
const read = (withScope = false): FakeResponse[] => [
  boardResponse([
    asTask(CURRENT, withScope ? [VENUE, SCOPE] : [VENUE], [RELEASE]),
    asTask(RELEASE, [CURRENT]),
    asTask(SCOPE, [], withScope ? [CURRENT] : []),
    asTask(VENUE, [], [CURRENT]),
  ]),
  projectsResponse(),
];
const found = (...items: LinkNode[]) => ({ body: { data: { backlog: { items } } } });
const added = (blocking: LinkNode, blocked: LinkNode) => ({
  body: { data: { addTaskDependency: { blockingTask: blocking, blockedTask: blocked } } },
});

/** TaskDependencyCycleGuard's refusal, word for word. */
const cycleMessage = (blocking: string, blocked: string, chain: string[]) =>
  `${blocking} can't block ${blocked}: ${blocked} already blocks ${blocking} (${chain.join(' → ')}), so this would create a cycle.`;
const refusedCycle = (chain: string[], blocking = 'TES-27') => ({
  body: gqlError('BAD_USER_INPUT', cycleMessage(blocking, 'TES-24', chain)),
});

type Sent = { query: string; variables: { input?: Record<string, unknown> } };
const addCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent)
    .filter((b) => b.query === ADD_TASK_DEPENDENCY_MUTATION);

/** Task dependencies of TES-24 → Add dependency → pick TES-27 as “Blocked by” → Add. */
async function tryTheCycle(refusal: FakeResponse, ...after: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...read(), found(RELEASE, SCOPE), refusal, ...after);
  const router = await renderApp(`/tasks/${CURRENT.id}/dependencies?boardId=${BOARD_ID}`);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add dependency' }));
  await fireEvent.press(await screen.findByTestId(`result-${RELEASE.id}`));
  await fireEvent.press(screen.getByTestId('submit-dependency'));
  return { router, fetchMock };
}

const listedKeys = (group: 'blocked-by' | 'blocks') =>
  within(screen.getByTestId(group))
    .getAllByRole('button')
    .map((b) => (b.props.accessibilityLabel as string).split(',')[0]);

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Recognising the backend’s cycle refusal', () => {
  const asError = (message: string, code = 'BAD_USER_INPUT') =>
    new GraphQLResponseError([{ message, extensions: { code } }], 200);

  it('reads a direct cycle and a longer one, with the path the backend found', () => {
    expect(toCycleInfo(asError(cycleMessage('TES-27', 'TES-24', ['TES-24', 'TES-27'])))).toEqual({
      blockingKey: 'TES-27',
      blockedKey: 'TES-24',
      existingPath: ['TES-24', 'TES-27'],
    });
    expect(toCycleInfo(asError(cycleMessage('TES-3', 'TES-1', ['TES-1', 'TES-2', 'TES-3'])))?.existingPath).toEqual([
      'TES-1',
      'TES-2',
      'TES-3',
    ]);
  });

  it('doesn’t take other errors for a cycle', () => {
    expect(toCycleInfo(asError('TES-24 and OTH-3 are in different projects. A task can only block a task of the same project.'))).toBeNull();
    expect(toCycleInfo(asError("A task can't block itself."))).toBeNull();
    expect(toCycleInfo(asError('This would create a cycle somewhere.'))).toBeNull();
    expect(toCycleInfo(asError(cycleMessage('TES-27', 'TES-24', ['TES-24', 'TES-27']), 'INTERNAL_ERROR'))).toBeNull();
    expect(toCycleInfo(new NetworkError(new TypeError('Network request failed')))).toBeNull();
    expect(toCycleInfo(new Error('boom'))).toBeNull();
  });
});

describe('A link that would close a cycle', () => {
  it('explains a direct cycle as in the design, and saves and shows nothing new', async () => {
    const { fetchMock } = await tryTheCycle(refusedCycle(['TES-24', 'TES-27']));

    const alert = await screen.findByTestId('cycle-error');
    expect(within(alert).getByText(CYCLE_TITLE)).toBeOnTheScreen();
    expect(within(alert).getByText('TES-27 already depends on TES-24. Choose another task or cancel.')).toBeOnTheScreen();
    const summary = screen.getByTestId('cycle-summary');
    expect(within(summary).getByText('Existing: TES-24 → TES-27')).toBeOnTheScreen();
    expect(within(summary).getByText('Rejected: TES-27 → TES-24')).toBeOnTheScreen();
    expect(within(summary).getByText('The new link was not saved.')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'Add dependency' })).toBeOnTheScreen();
    expect(screen.getByTestId('relationship-select')).toHaveTextContent('Blocked by');
    expect(within(screen.getByTestId(`rejected-${RELEASE.id}`)).getByText('Publish release notes')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose another task' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();

    expect(screen.queryByText('Dependency added')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
    expect(addCalls(fetchMock)[0].variables.input).toEqual({ blockingTaskId: RELEASE.id, blockedTaskId: CURRENT.id });
    // No reload, no other request: nothing changed on the backend.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('shows the longer path for a cycle through other tasks', async () => {
    await tryTheCycle(refusedCycle(['TES-24', 'TES-26', 'TES-27']));

    expect(await screen.findByText('Existing: TES-24 → TES-26 → TES-27')).toBeOnTheScreen();
    expect(screen.getByText('Rejected: TES-27 → TES-24')).toBeOnTheScreen();
  });

  it('keeps every saved dependency as it was after Cancel, without the refused one', async () => {
    const { fetchMock } = await tryTheCycle(refusedCycle(['TES-24', 'TES-27']));
    await screen.findByTestId('cycle-error');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('header', { name: 'Task dependencies' })).toBeOnTheScreen();
    expect(listedKeys('blocked-by')).toEqual(['TES-30']);
    expect(listedKeys('blocks')).toEqual(['TES-27']);
    expect(screen.getByText('Blocked by · 1 task')).toBeOnTheScreen();
    expect(screen.queryByText('Dependency added')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('cycle-error')).not.toBeOnTheScreen();
    expect(addCalls(fetchMock)).toHaveLength(1);
  });

  it('lets the manager choose another task and retry; the accepted link appears, the refused one never does', async () => {
    const { router, fetchMock } = await tryTheCycle(
      refusedCycle(['TES-24', 'TES-27']),
      found(RELEASE, SCOPE),
      added(SCOPE, CURRENT),
      ...read(true),
      ...read(true),
    );
    await screen.findByTestId('cycle-error');

    await fireEvent.press(screen.getByRole('button', { name: 'Choose another task' }));
    expect(screen.getByText('Choose another task')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search tasks…')).toBeOnTheScreen();
    // The refused task, the same way round, can't be picked again.
    const refused = await screen.findByTestId(`result-${RELEASE.id}`);
    expect(refused).toBeDisabled();
    expect(within(refused).getByText('TES-27 · To do · Creates a cycle')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`result-${SCOPE.id}`));
    expect(screen.getByRole('button', { name: 'Retry with TES-18' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(await screen.findByText('Dependency added')).toBeOnTheScreen();
    expect(addCalls(fetchMock)[1].variables.input).toEqual({ blockingTaskId: SCOPE.id, blockedTaskId: CURRENT.id });
    await waitFor(() => expect(listedKeys('blocked-by')).toEqual(['TES-30', 'TES-18']));
    expect(listedKeys('blocks')).toEqual(['TES-27']);
    expect(screen.getByTestId('never-added-note')).toHaveTextContent('The rejected TES-27 link was never added.');
    expect(screen.queryByTestId('cycle-error')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add another dependency' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to task' }));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${CURRENT.id}`));
    expect(await screen.findByText('Blocked by · 2 tasks')).toBeOnTheScreen();
  });

  it('keeps the explanation on screen while retrying, and replaces it if the retry is refused too', async () => {
    let answer!: (value: unknown) => void;
    await tryTheCycle(refusedCycle(['TES-24', 'TES-27']), found(RELEASE, SCOPE));
    await screen.findByTestId('cycle-error');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose another task' }));
    await fireEvent.press(await screen.findByTestId(`result-${SCOPE.id}`));
    const pending = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = pending as unknown as typeof fetch;

    await fireEvent.press(screen.getByTestId('submit-dependency'));
    await fireEvent.press(screen.getByTestId('submit-dependency'));

    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-dependency')).toBeDisabled();
    expect(screen.getByTestId('cycle-error')).toBeOnTheScreen();
    expect(pending).toHaveBeenCalledTimes(1);

    answer({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(refusedCycle(['TES-24', 'TES-25', 'TES-18'], 'TES-18').body),
    });
    expect(await screen.findByText('TES-18 already depends on TES-24. Choose another task or cancel.')).toBeOnTheScreen();
    expect(screen.getByText('Existing: TES-24 → TES-25 → TES-18')).toBeOnTheScreen();
    expect(screen.getAllByTestId('cycle-error')).toHaveLength(1);
    expect(screen.queryByText('Dependency added')).not.toBeOnTheScreen();
  });
});

describe('Other failures are not cycles', () => {
  it('shows an unrelated refusal as itself, with no cycle explanation', async () => {
    const message = 'TES-24 and OTH-3 are in different projects. A task can only block a task of the same project.';
    await tryTheCycle({ body: gqlError('BAD_USER_INPUT', message) });

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(screen.queryByTestId('cycle-error')).not.toBeOnTheScreen();
    expect(screen.queryByText(CYCLE_TITLE)).not.toBeOnTheScreen();
  });

  it.each([
    ['no response', 'network-error' as const],
    ['a server error', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }],
  ])('handles %s, keeps the saved dependencies, and can try again', async (_, failure) => {
    const { fetchMock } = await tryTheCycle(failure as FakeResponse, added(RELEASE, CURRENT), ...read());

    expect(await screen.findByTestId('form-error')).toHaveTextContent(ADD_FAILED);
    expect(screen.queryByTestId('cycle-error')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`selected-${RELEASE.id}`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('submit-dependency'));
    expect(await screen.findByText('Dependency added')).toBeOnTheScreen();
    expect(addCalls(fetchMock)).toHaveLength(2);
    expect(listedKeys('blocked-by')).toEqual(['TES-30']);
  });
});
