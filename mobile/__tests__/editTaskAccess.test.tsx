import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { BOARD_WITH_TASKS_QUERY, PROJECTS_QUERY, type ProjectNode } from '../src/api/boards';
import { UPDATE_TASK_MUTATION } from '../src/api/tasks';
import { getSession, setSession } from '../src/auth/session';
import { hasLostAccess } from '../src/data/projectAccess';
import { SAVE_FAILED } from '../src/domain/editTask';
import {
  API_URL,
  BOARD_ID,
  type FakeResponse,
  PROJECT_ID,
  PROJECT_MEMBERS,
  boardResponse,
  gqlError,
  mockFetch,
  projectsResponse,
  titleOnlyTaskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

/**
 * US-5 follow-up (QA): a Writer edits a task, is removed from the project in another session, then
 * saves. The backend refuses the save; the app must check access at once, as when it resumes, and
 * clear the project's data everywhere instead of leaving the editor on screen.
 */

const TASK = titleOnlyTaskNode(0, {
  id: '01a18766-8315-7c9c-90fd-5657de973401',
  title: 'Draft the sitemap',
  description: 'Private notes about the redesign',
});
const OTHER_ID = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1c';

const project = (role = 'WRITER'): ProjectNode => ({
  id: PROJECT_ID,
  name: 'Website redesign',
  role,
  boards: [{ id: BOARD_ID, name: 'Sprint board' }],
  projectMembers: PROJECT_MEMBERS,
});
const other: ProjectNode = {
  id: OTHER_ID,
  name: 'Product launch',
  role: 'READER',
  boards: [],
  projectMembers: PROJECT_MEMBERS,
};
const mine = (...projects: ProjectNode[]) => projectsResponse(projects);
/** What a task screen reads: the board and its tasks, then the user's projects. */
const taskRead = (role = 'WRITER'): FakeResponse[] => [boardResponse([TASK]), mine(project(role), other)];
/** The backend's answers to someone who is no longer a member (TaskLookupService, GetTasksHandler). */
const saveRefused = (): FakeResponse => ({ body: gqlError('NOT_FOUND', `Task '${TASK.id}' was not found.`) });
const boardRefused = (): FakeResponse => ({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });

const taskUrl = `/tasks/${TASK.id}?boardId=${BOARD_ID}`;

type Sent = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const queries = (fetchMock: jest.Mock) => sent(fetchMock).map((b) => b.query);
const saves = (fetchMock: jest.Mock) => queries(fetchMock).filter((q) => q === UPDATE_TASK_MUTATION).length;

const hidden = { includeHiddenElements: true };
/** Nothing of the project or the task anywhere, not even on screens further back in the stack. */
function expectNothingOfTheProject() {
  expect(screen.queryByText(/Draft the sitemap|Private notes|Website redesign|WEBSITE REDESIGN/, hidden)).not.toBeOnTheScreen();
  expect(screen.queryByDisplayValue(/Draft the sitemap|Private notes|Sitemap v2/, hidden)).not.toBeOnTheScreen();
  expect(screen.queryByTestId('title-input', hidden)).not.toBeOnTheScreen();
  expect(screen.queryByTestId('description-input', hidden)).not.toBeOnTheScreen();
}

async function open(...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(taskUrl);
  return { router, fetchMock };
}

/** Task details, then Edit task, as QA did; each reads the task from the backend. */
async function openEditor(...responses: FakeResponse[]) {
  const opened = await open(...taskRead(), ...taskRead(), ...responses);
  await fireEvent.press(await screen.findByTestId('edit-task-button'));
  await screen.findByDisplayValue('Draft the sitemap');
  return opened;
}

const editAndSave = async () => {
  await fireEvent.changeText(screen.getByTestId('title-input'), 'Sitemap v2');
  await fireEvent.press(screen.getByTestId('save-button'));
};

const appStateListeners = new Set<(state: string) => void>();
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
  appStateListeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    const handler = listener as (state: string) => void;
    appStateListeners.add(handler);
    return { remove: () => appStateListeners.delete(handler) } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('A save refused because the membership was removed (QA scenario)', () => {
  it('checks access at once and clears the task, its project and the editor everywhere', async () => {
    const { fetchMock } = await openEditor(saveRefused(), boardRefused());
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent(/WEBSITE REDESIGN/);
    expect(screen.getByDisplayValue('Private notes about the redesign')).toBeOnTheScreen();

    await editAndSave();

    // The same read as on resume, right after the refused save, and refused too.
    expect(await screen.findByRole('header', { name: 'Your project access has changed' })).toBeOnTheScreen();
    const calls = queries(fetchMock);
    expect(calls.indexOf(BOARD_WITH_TASKS_QUERY, calls.indexOf(UPDATE_TASK_MUTATION))).toBeGreaterThan(-1);
    expect(saves(fetchMock)).toBe(1);

    // Task details, still open under the editor, is cleared too: Back can't show the task again.
    expect(screen.getAllByTestId('access-revoked', hidden)).toHaveLength(2);
    expectNothingOfTheProject();
    expect(hasLostAccess(PROJECT_ID)).toBe(true);
  });

  it('then leads to the project list, read again: the project is gone, the others and the session stay', async () => {
    const { router, fetchMock } = await openEditor(saveRefused(), boardRefused(), mine(other));
    await editAndSave();
    await screen.findByTestId('access-revoked');

    await fireEvent.press(screen.getByTestId('back-to-projects'));

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(await screen.findByText('Product launch')).toBeOnTheScreen();
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);
    expectNothingOfTheProject();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
    expect(getSession()).not.toBeNull();
  });

  it('locks the form while access is checked, and sends the save once however often it is tapped', async () => {
    await openEditor();
    let answer!: (value: unknown) => void;
    // The save is refused; the access check then waits for its answer.
    let call = 0;
    const fetchMock = jest.fn(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify((saveRefused() as { body: unknown }).body) });
      }
      return new Promise((resolve) => (answer = resolve));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await editAndSave();
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(await screen.findByText('Checking access…')).toBeOnTheScreen();
    expect(screen.getByTestId('save-button')).toBeDisabled();
    expect(screen.getByTestId('title-input').props.editable).toBe(false);
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(saves(fetchMock)).toBe(1);

    await act(async () => answer({ ok: true, status: 200, text: async () => JSON.stringify((boardRefused() as { body: unknown }).body) }));
    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expectNothingOfTheProject();
  });

  it('a read started before the refusal can’t bring the task back when it answers late', async () => {
    resetSecureStore(storedSession());
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    let lateBoard!: (value: unknown) => void;
    let boardReads = 0;
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      const { query } = JSON.parse(init.body as string) as Sent;
      if (query === UPDATE_TASK_MUTATION) return ok((saveRefused() as { body: unknown }).body);
      if (query === BOARD_WITH_TASKS_QUERY) {
        boardReads += 1;
        // 1: the editor's first read. 2: the resume read, answered late. 3: the access check.
        if (boardReads === 2) return new Promise((resolve) => (lateBoard = resolve));
        if (boardReads === 3) return ok((boardRefused() as { body: unknown }).body);
        return ok((boardResponse([TASK]) as { body: unknown }).body);
      }
      if (query === PROJECTS_QUERY) return ok((mine(project(), other) as { body: unknown }).body);
      return ok(meResponse().body);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderApp(`/tasks/${TASK.id}/edit?boardId=${BOARD_ID}`);
    await screen.findByDisplayValue('Draft the sitemap');

    // The app comes back to the foreground: a read starts and hasn't answered yet.
    await act(async () => appStateListeners.forEach((listener) => listener('background')));
    await act(async () => appStateListeners.forEach((listener) => listener('active')));
    await editAndSave();
    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();

    // The earlier read answers now, with the task: it is ignored.
    await act(async () => lateBoard(ok((boardResponse([TASK]) as { body: unknown }).body)));
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(screen.getByTestId('access-revoked')).toBeOnTheScreen();
    expectNothingOfTheProject();
  });
});

describe('Refusals that are not a lost membership keep the editor', () => {
  it('a validation error is shown at its field; the task stays and nothing is checked', async () => {
    const { fetchMock } = await openEditor({ body: gqlError('BAD_USER_INPUT', 'Title cannot be empty or only spaces.') });
    await editAndSave();

    expect(await screen.findByTestId('title-error')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Sitemap v2')).toBeOnTheScreen();
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent(/WEBSITE REDESIGN/);
    expect(queries(fetchMock).at(-1)).toBe(UPDATE_TASK_MUTATION);
    expect(hasLostAccess(PROJECT_ID)).toBe(false);
  });

  it('a member without the role to edit (AUTH_NOT_AUTHORIZED) sees why; the task stays', async () => {
    const message = 'Only writers and owners of the project can edit tasks.';
    const { fetchMock } = await openEditor({ body: gqlError('AUTH_NOT_AUTHORIZED', message) });
    await editAndSave();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(screen.getByDisplayValue('Private notes about the redesign')).toBeOnTheScreen();
    expect(queries(fetchMock).at(-1)).toBe(UPDATE_TASK_MUTATION);
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });

  it('no connection is a failed save, not a lost membership', async () => {
    const { fetchMock } = await openEditor('network-error');
    await editAndSave();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(SAVE_FAILED);
    expect(screen.getByDisplayValue('Sitemap v2')).toBeOnTheScreen();
    expect(queries(fetchMock).at(-1)).toBe(UPDATE_TASK_MUTATION);
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
    expect(hasLostAccess(PROJECT_ID)).toBe(false);
  });

  it('a refused save of a task that is still there keeps the typed changes, to try again', async () => {
    await openEditor(saveRefused(), ...taskRead());
    await editAndSave();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(SAVE_FAILED);
    expect(screen.getByDisplayValue('Sitemap v2')).toBeOnTheScreen();
    expect(screen.getByTestId('save-button')).toBeEnabled();
    expect(hasLostAccess(PROJECT_ID)).toBe(false);
  });

  it('if the access check gets no answer either, the task is hidden until access is confirmed', async () => {
    await openEditor(saveRefused(), 'network-error', ...taskRead());
    await editAndSave();

    expect(await screen.findByRole('header', { name: 'Couldn’t connect' })).toBeOnTheScreen();
    expect(screen.queryByTestId('title-input')).not.toBeOnTheScreen();
    expect(screen.queryByText('Private notes about the redesign')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();

    // Try again: still a member, so the task is back.
    await fireEvent.press(screen.getByTestId('access-retry'));
    expect(await screen.findByDisplayValue('Draft the sitemap')).toBeOnTheScreen();
  });
});
