import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { BACKLOG_QUERY, RANK_TASK_MUTATION, type BacklogItemNode } from '../src/api/backlog';
import { UPDATE_TASK_MUTATION } from '../src/api/tasks';
import { setSession } from '../src/auth/session';
import {
  ORDER_CHANGED,
  ORDER_SAVED,
  READ_ONLY_NOTE,
  REORDER_PAUSED,
  SAVE_FAILED,
  anchorPosition,
  canManageBacklog,
  dropIndex,
  moveItem,
  positionError,
} from '../src/domain/backlog';
import type { ColumnCategory, TaskPriority } from '../src/domain/models';
import {
  API_URL,
  PROJECTS,
  PROJECT_ID,
  type FakeResponse,
  gqlError,
  mockFetch,
  projectsResponse,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const COLUMN_NAMES: Record<ColumnCategory, string> = {
  BACKLOG: 'Backlog',
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const idOf = (n: number) => `01a18766-8315-7c9c-90fd-5657de97${String(n).padStart(4, '0')}`;

const item = (
  n: number,
  title: string,
  priority: TaskPriority | null = null,
  status: ColumnCategory = 'TO_DO',
): BacklogItemNode => ({
  id: idOf(n),
  readableId: `TES-${n}`,
  title,
  status,
  priority,
  storyPoints: null,
  boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
  column: { name: COLUMN_NAMES[status] },
});

/** The design's three items, in the backend's order. */
const T31 = item(31, 'Prepare launch checklist', 'HIGH');
const T32 = item(32, 'Review permissions', 'MEDIUM');
const T33 = item(33, 'Update project guide', 'LOW');
const DESIGN = [T31, T32, T33];

const page = (
  items: BacklogItemNode[],
  { totalCount = items.length, pageNumber = 1, pageSize = 20, hasNextPage = false } = {},
) => ({
  body: {
    data: {
      backlog: {
        items,
        totalCount,
        page: pageNumber,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        hasNextPage,
      },
    },
  },
});

const many = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => item(start + i, `Backlog task ${start + i}`, 'MEDIUM'));

const withRole = (role: string) => projectsResponse(PROJECTS.map((p) => (p.id === PROJECT_ID ? { ...p, role } : p)));

const rankOk = (n: number) => ({ body: { data: { rankTask: { id: idOf(n), readableId: `TES-${n}` } } } });
const updated = (n: number, priority: TaskPriority | null) => ({
  body: { data: { updateTask: taskNode({ id: idOf(n), readableId: `TES-${n}`, priority }) } },
});

type Sent = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent);
const callsOf = (fetchMock: jest.Mock, query: string) => sent(fetchMock).filter((b) => b.query === query);

const backlogUrl = `/projects/${PROJECT_ID}/backlog`;

async function openBacklog(role: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), withRole(role), ...responses);
  const router = await renderApp(backlogUrl);
  await screen.findByTestId('backlog-count');
  return { router, fetchMock };
}

/** The keys of the rows, in the order shown. */
const keys = () =>
  screen.queryAllByTestId(/^backlog-item-/).map((row) => (row.props.accessibilityLabel as string).split(', ')[1]);

const handle = (n: number) => screen.getByTestId(`backlog-handle-${idOf(n)}`);
const handleAction = (n: number, actionName: string) =>
  fireEvent(handle(n), 'accessibilityAction', { nativeEvent: { actionName } });

/** Selects the item with its handle, then opens Item actions. */
async function openActions(n: number) {
  await handleAction(n, 'activate');
  await fireEvent.press(screen.getByTestId('item-actions-button'));
  return screen.findByTestId('item-actions');
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Permissions', () => {
  it('gives the owner drag handles and Item actions, as in the design', async () => {
    await openBacklog('OWNER', page(DESIGN));

    expect(screen.getByTestId('backlog-role-view')).toHaveTextContent('Test Project · Owner view', { exact: false });
    expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33']);
    DESIGN.forEach((t) => expect(screen.getByTestId(`backlog-handle-${t.id}`)).toBeOnTheScreen());
    // Nothing is chosen yet, so Item actions waits for a choice.
    expect(screen.getByTestId('item-actions-button').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText(READ_ONLY_NOTE)).not.toBeOnTheScreen();
  });

  it('gives writers the same controls: the backend lets writers and owners manage the backlog', async () => {
    await openBacklog('WRITER', page(DESIGN));

    expect(screen.getByTestId('backlog-role-view')).toHaveTextContent('Writer view', { exact: false });
    expect(handle(31)).toBeOnTheScreen();
    expect(screen.getByTestId('item-actions-button')).toBeOnTheScreen();
  });

  it('shows a reader the list read-only: no handles, no actions, no selection, no priority sheet', async () => {
    const { fetchMock } = await openBacklog('READER', page(DESIGN));

    expect(screen.getByTestId('backlog-role-view')).toHaveTextContent('Reader view', { exact: false });
    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
    expect(screen.queryByTestId('item-actions-button')).not.toBeOnTheScreen();
    expect(screen.getByTestId('read-only-note')).toHaveTextContent(READ_ONLY_NOTE, { exact: false });

    await fireEvent(screen.getByTestId(`backlog-item-${T31.id}`), 'longPress');
    expect(screen.queryByTestId('item-actions')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('priority-sheet')).not.toBeOnTheScreen();
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
    expect(callsOf(fetchMock, UPDATE_TASK_MUTATION)).toHaveLength(0);
  });

  it('shows no controls when the backend gives no role', async () => {
    resetSecureStore(storedSession());
    mockFetch(meResponse(), projectsResponse(), page(DESIGN));
    await renderApp(backlogUrl);
    await screen.findByTestId('backlog-count');

    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
    expect(screen.queryByTestId('item-actions-button')).not.toBeOnTheScreen();
  });
});

describe('Priority', () => {
  it('shows each item’s saved priority', async () => {
    await openBacklog('OWNER', page([...DESIGN, item(34, 'No priority yet', null)]));

    expect(within(screen.getByTestId(`backlog-item-${T31.id}`)).getByText('To do · High')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`backlog-item-${T33.id}`)).getByText('To do · Low')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`backlog-item-${idOf(34)}`)).getByText('To do · No priority')).toBeOnTheScreen();
  });

  it('offers exactly the backend’s values and No priority, with the saved one chosen', async () => {
    await openBacklog('OWNER', page(DESIGN));
    await openActions(31);
    await fireEvent.press(screen.getByTestId('action-change-priority'));

    const sheet = await screen.findByTestId('priority-sheet');
    expect(within(sheet).getByText('TES-31 · Prepare launch checklist')).toBeOnTheScreen();
    const options = within(sheet).getAllByRole('radio');
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual(['No priority', 'Low', 'Medium', 'High', 'Critical']);
    expect(within(sheet).getByTestId('priority-option-HIGH').props.accessibilityState).toMatchObject({ checked: true });
    // Nothing changed yet: nothing to apply.
    expect(within(sheet).getByTestId('apply-priority').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('saves with updateTask (only the priority), shows the confirmed value, and reads the list again; the order stays', async () => {
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(DESIGN),
      updated(31, 'CRITICAL'),
      page([{ ...T31, priority: 'CRITICAL' }, T32, T33]),
    );
    await openActions(31);
    await fireEvent.press(screen.getByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-CRITICAL'));
    await fireEvent.press(screen.getByTestId('apply-priority'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent('Priority updated to Critical', { exact: false });
    await waitFor(() => expect(screen.queryByTestId('priority-sheet')).not.toBeOnTheScreen());
    expect(within(screen.getByTestId(`backlog-item-${T31.id}`)).getByText('To do · Critical')).toBeOnTheScreen();

    const updates = callsOf(fetchMock, UPDATE_TASK_MUTATION);
    expect(updates).toHaveLength(1);
    expect(updates[0].query).toContain('updateTask(input: $input)');
    expect(updates[0].variables).toEqual({ input: { taskId: T31.id, priority: 'CRITICAL' } });
    // Priority isn't rank: no reorder is sent, and the backend's order is kept.
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
    await waitFor(() => expect(callsOf(fetchMock, BACKLOG_QUERY)).toHaveLength(2));
    expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33']);
  });

  it('clears the priority with null for No priority', async () => {
    const { fetchMock } = await openBacklog('WRITER', page(DESIGN), updated(33, null), page([T31, T32, { ...T33, priority: null }]));
    await openActions(33);
    await fireEvent.press(screen.getByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-NONE'));
    await fireEvent.press(screen.getByTestId('apply-priority'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent('Priority updated to No priority', { exact: false });
    expect(callsOf(fetchMock, UPDATE_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T33.id, priority: null } });
  });

  it('keeps the saved priority when the backend can’t be reached, and keeps the draft to try again', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), 'network-error', updated(31, 'LOW'), page(DESIGN));
    await openActions(31);
    await fireEvent.press(screen.getByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-LOW'));
    await fireEvent.press(screen.getByTestId('apply-priority'));

    const error = await screen.findByTestId('priority-error');
    expect(error).toHaveTextContent(/Couldn’t update the priority\./, { exact: false });
    expect(error).toHaveTextContent(/We couldn’t reach the server/, { exact: false });
    expect(screen.getByTestId('priority-option-LOW').props.accessibilityState).toMatchObject({ checked: true });
    expect(within(screen.getByTestId(`backlog-item-${T31.id}`)).getByText('To do · High')).toBeOnTheScreen();
    expect(screen.queryByTestId('success-banner')).not.toBeOnTheScreen();

    // Try again sends the same draft.
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('success-banner')).toHaveTextContent('Priority updated to Low', { exact: false });
    expect(callsOf(fetchMock, UPDATE_TASK_MUTATION).map((c) => c.variables)).toEqual([
      { input: { taskId: T31.id, priority: 'LOW' } },
      { input: { taskId: T31.id, priority: 'LOW' } },
    ]);
  });

  it('shows the backend’s refusal and reads the role again, which removes the controls', async () => {
    const { fetchMock } = await openBacklog(
      'WRITER',
      page(DESIGN),
      { body: gqlError('AUTH_NOT_AUTHORIZED', 'Only writers and owners of the project can edit tasks.') },
      withRole('READER'),
    );
    await openActions(31);
    await fireEvent.press(screen.getByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-CRITICAL'));
    await fireEvent.press(screen.getByTestId('apply-priority'));

    await waitFor(() => expect(screen.getByTestId('read-only-note')).toBeOnTheScreen());
    expect(screen.queryByTestId('priority-sheet')).not.toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
    expect(within(screen.getByTestId(`backlog-item-${T31.id}`)).getByText('To do · High')).toBeOnTheScreen();
    expect(screen.queryByTestId('success-banner')).not.toBeOnTheScreen();
    expect(callsOf(fetchMock, UPDATE_TASK_MUTATION)).toHaveLength(1);
  });

  it('discards the draft when the sheet is closed', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN));
    await openActions(31);
    await fireEvent.press(screen.getByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-LOW'));
    await fireEvent.press(screen.getByTestId('priority-close'));

    await waitFor(() => expect(screen.queryByTestId('priority-sheet')).not.toBeOnTheScreen());
    expect(callsOf(fetchMock, UPDATE_TASK_MUTATION)).toHaveLength(0);
    expect(within(screen.getByTestId(`backlog-item-${T31.id}`)).getByText('To do · High')).toBeOnTheScreen();
  });
});

describe('Reordering', () => {
  it('offers Move up/down by place: Up is off for the first item and Down for the last', async () => {
    await openBacklog('OWNER', page(DESIGN));

    let actions = await openActions(31);
    expect(within(actions).getByText('TES-31 · Position 1')).toBeOnTheScreen();
    expect(within(actions).getByTestId('action-move-up').props.accessibilityState).toMatchObject({ disabled: true });
    expect(within(actions).getByTestId('action-move-down').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(within(actions).getByTestId('action-cancel'));

    actions = await openActions(33);
    expect(within(actions).getByTestId('action-move-up').props.accessibilityState).toMatchObject({ disabled: false });
    expect(within(actions).getByTestId('action-move-down').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('moves an item before another (to the top: afterTaskId null), then shows the order the backend returns', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), rankOk(32), page([T32, T31, T33]));
    const actions = await openActions(32);
    expect(within(actions).getByText('TES-32 · Position 2')).toBeOnTheScreen();

    await fireEvent.press(within(actions).getByTestId('action-move-up'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(ORDER_SAVED, { exact: false });
    expect(keys()).toEqual(['TES-32', 'TES-31', 'TES-33']);
    const ranks = callsOf(fetchMock, RANK_TASK_MUTATION);
    expect(ranks).toHaveLength(1);
    expect(ranks[0].query).toContain('rankTask(input: $input)');
    expect(ranks[0].variables).toEqual({ input: { taskId: T32.id, afterTaskId: null } });
    // The saved order is read back with a fresh, unfiltered backlog query.
    const reads = callsOf(fetchMock, BACKLOG_QUERY);
    expect(reads).toHaveLength(2);
    expect(reads[1].variables).toEqual({ projectId: PROJECT_ID, page: 1, pageSize: 20 });
  });

  it('moves an item before a middle item: right after the one before it', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), rankOk(33), page([T31, T33, T32]));
    await fireEvent.press(within(await openActions(33)).getByTestId('action-move-up'));

    await screen.findByTestId('success-banner');
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T33.id, afterTaskId: T31.id } });
    expect(keys()).toEqual(['TES-31', 'TES-33', 'TES-32']);
  });

  it('moves an item after another', async () => {
    const { fetchMock } = await openBacklog('WRITER', page(DESIGN), rankOk(31), page([T32, T31, T33]));
    await fireEvent.press(within(await openActions(31)).getByTestId('action-move-down'));

    await screen.findByTestId('success-banner');
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T31.id, afterTaskId: T32.id } });
    expect(keys()).toEqual(['TES-32', 'TES-31', 'TES-33']);
  });

  it('shows the backend’s order after saving, not the local preview', async () => {
    // Someone else added TES-40 at the top meanwhile: the list shows exactly what the server has.
    const T40 = item(40, 'Added by someone else');
    await openBacklog('OWNER', page(DESIGN), rankOk(31), page([T40, T32, T31, T33]));
    await fireEvent.press(within(await openActions(31)).getByTestId('action-move-down'));

    await screen.findByTestId('success-banner');
    expect(keys()).toEqual(['TES-40', 'TES-32', 'TES-31', 'TES-33']);
  });

  it('shows the preview while saving, with Saving… and no other change possible', async () => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const queue: (() => Promise<unknown>)[] = [meResponse(), withRole('OWNER'), page(DESIGN)].map(
      (r) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(r.body) }),
    );
    queue.push(() => new Promise((resolve) => (answer = resolve)));
    const fetchMock = jest.fn(() => queue.shift()!());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderApp(backlogUrl);
    await screen.findByTestId('backlog-count');

    await fireEvent.press(within(await openActions(32)).getByTestId('action-move-up'));

    expect(await screen.findByTestId('saving-order')).toHaveTextContent('Saving order…', { exact: false });
    expect(keys()).toEqual(['TES-32', 'TES-31', 'TES-33']);
    const button = screen.getByTestId('item-actions-button');
    expect(button).toHaveTextContent('Saving…', { exact: false });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    // A second move during the save sends nothing.
    await handleAction(31, 'moveDown');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    queue.push(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(page([T32, T31, T33]).body) }));
    answer({ ok: true, status: 200, text: async () => JSON.stringify(rankOk(32).body) });
    expect(await screen.findByTestId('success-banner')).toHaveTextContent(ORDER_SAVED, { exact: false });
  });

  it('restores the previous order when the backend refuses, and says so', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), 'network-error');
    await fireEvent.press(within(await openActions(32)).getByTestId('action-move-up'));

    const error = await screen.findByTestId('backlog-save-error');
    expect(error).toHaveTextContent(new RegExp(SAVE_FAILED), { exact: false });
    expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33']);
    expect(screen.queryByTestId('success-banner')).not.toBeOnTheScreen();
    // The item stays selected, so it can be tried again from Item actions.
    expect(screen.getByTestId('item-actions-button').props.accessibilityLabel).toBe('Item actions for TES-32');
    expect(callsOf(fetchMock, BACKLOG_QUERY)).toHaveLength(1);
  });

  it('reads the latest list when the item or its neighbour changed on the server', async () => {
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(DESIGN),
      { body: gqlError('NOT_FOUND', `Task '${T31.id}' was not found in this project.`) },
      page([T32, T33]),
    );
    await fireEvent.press(within(await openActions(33)).getByTestId('action-move-up'));

    expect(await screen.findByTestId('backlog-save-error')).toHaveTextContent(ORDER_CHANGED, { exact: false });
    await waitFor(() => expect(keys()).toEqual(['TES-32', 'TES-33']));
    expect(callsOf(fetchMock, BACKLOG_QUERY)).toHaveLength(2);
  });

  it('reads the role again when the backend refuses the move by role', async () => {
    await openBacklog(
      'WRITER',
      page(DESIGN),
      { body: gqlError('AUTH_NOT_AUTHORIZED', 'Only writers and owners of the project can change the backlog order.') },
      withRole('READER'),
    );
    await fireEvent.press(within(await openActions(32)).getByTestId('action-move-up'));

    expect(await screen.findByTestId('backlog-save-error')).toHaveTextContent('Only writers and owners of the project can change the backlog order.', { exact: false });
    await waitFor(() => expect(screen.getByTestId('read-only-note')).toBeOnTheScreen());
    expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33']);
  });

  it('moves to a typed position, naming the item it goes before, and refuses out-of-range numbers inline', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), rankOk(32), page([T32, T31, T33]));
    await fireEvent.press(within(await openActions(32)).getByTestId('action-move-to'));

    const panel = await screen.findByTestId('move-to-position');
    expect(within(panel).getByText('TES-32 · Current position 2 of 3')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('position-input'), '4');
    expect(screen.getByTestId('position-error')).toHaveTextContent('Enter a position from 1 to 3.', { exact: false });
    await fireEvent.press(screen.getByTestId('move-item'));
    await fireEvent.changeText(screen.getByTestId('position-input'), '2');
    expect(screen.getByTestId('position-error')).toHaveTextContent('This item is already at position 2.', { exact: false });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('position-input'), '1');
    expect(screen.getByTestId('position-hint')).toHaveTextContent('Move this item before TES-31.', { exact: false });
    await fireEvent.press(screen.getByTestId('move-item'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(ORDER_SAVED, { exact: false });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T32.id, afterTaskId: null } });
  });

  it('moves by dragging the handle among the loaded rows', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), rankOk(31), page([T32, T33, T31]));
    for (const [i, t] of DESIGN.entries()) {
      await fireEvent(screen.getByTestId(`backlog-row-${t.id}`), 'layout', {
        nativeEvent: { layout: { x: 0, y: i * 80, width: 300, height: 70 } },
      });
    }

    await fireEvent(handle(31), 'responderGrant', { nativeEvent: { pageY: 100 } });
    await fireEvent(handle(31), 'responderMove', { nativeEvent: { pageY: 200 } });
    await fireEvent(handle(31), 'responderRelease', { nativeEvent: { pageY: 270 } });

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(ORDER_SAVED, { exact: false });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T31.id, afterTaskId: T33.id } });
    expect(keys()).toEqual(['TES-32', 'TES-33', 'TES-31']);
  });

  it('selects with a tap on the handle, without moving anything', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN));

    await fireEvent(handle(32), 'responderGrant', { nativeEvent: { pageY: 100 } });
    await fireEvent(handle(32), 'responderRelease', { nativeEvent: { pageY: 102 } });

    expect(screen.getByTestId('item-actions-button').props.accessibilityLabel).toBe('Item actions for TES-32');
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
  });

  it('lets a screen reader move an item with the handle’s actions', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), rankOk(31), page([T32, T31, T33]));

    await handleAction(31, 'moveDown');

    await screen.findByTestId('success-banner');
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: T31.id, afterTaskId: T32.id } });
  });

  it('shows other members the saved order through their own fresh backlog query', async () => {
    // What the server returns after the owner's move is what a reader opening the backlog gets.
    await openBacklog('READER', page([T32, T31, T33]));

    expect(keys()).toEqual(['TES-32', 'TES-31', 'TES-33']);
    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
  });
});

describe('Search and filters', () => {
  it('pauses reordering while searching, keeps priority editing, and Clear search & filters brings the backend’s order back', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), page([T31]), page(DESIGN));

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'launch');
    await waitFor(() => expect(keys()).toEqual(['TES-31']));

    expect(screen.getByTestId('reorder-paused')).toHaveTextContent(REORDER_PAUSED, { exact: false });
    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
    // A long-press chooses the item; only its priority can change here.
    await fireEvent(screen.getByTestId(`backlog-item-${T31.id}`), 'longPress');
    await fireEvent.press(screen.getByTestId('item-actions-button'));
    const actions = await screen.findByTestId('item-actions');
    expect(within(actions).getByText('TES-31 · High')).toBeOnTheScreen();
    expect(within(actions).queryByTestId('action-move-up')).not.toBeOnTheScreen();
    expect(within(actions).queryByTestId('action-move-down')).not.toBeOnTheScreen();
    expect(within(actions).queryByTestId('action-move-to')).not.toBeOnTheScreen();
    expect(within(actions).getByTestId('action-change-priority')).toBeOnTheScreen();
    await fireEvent.press(within(actions).getByTestId('action-cancel'));

    await fireEvent.press(screen.getByTestId('clear-search-filters'));
    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33']));
    expect(callsOf(fetchMock, BACKLOG_QUERY).at(-1)!.variables).toEqual({ projectId: PROJECT_ID, page: 1, pageSize: 20 });
    expect(handle(31)).toBeOnTheScreen();
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
  });

  it('pauses reordering while a filter is on, and never numbers filtered results as backlog places', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), page([T32, T33]));

    await fireEvent.press(screen.getByTestId('status-TO_DO'));
    await waitFor(() => expect(keys()).toEqual(['TES-32', 'TES-33']));

    expect(screen.getByTestId('reorder-paused')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^backlog-handle-/)).toHaveLength(0);
    // No "Showing 1–n of N" either: the filtered numbers aren't the backlog's places.
    expect(screen.queryByTestId('backlog-range')).not.toBeOnTheScreen();
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
  });

  it('keeps the search when a priority saved in the filtered list is read again', async () => {
    const { fetchMock } = await openBacklog('OWNER', page(DESIGN), page([T31]), updated(31, 'LOW'), page([{ ...T31, priority: 'LOW' }]));
    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'launch');
    await waitFor(() => expect(keys()).toEqual(['TES-31']));

    await fireEvent(screen.getByTestId(`backlog-item-${T31.id}`), 'longPress');
    await fireEvent.press(screen.getByTestId('item-actions-button'));
    await fireEvent.press(await screen.findByTestId('action-change-priority'));
    await fireEvent.press(await screen.findByTestId('priority-option-LOW'));
    await fireEvent.press(screen.getByTestId('apply-priority'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent('Priority updated to Low', { exact: false });
    await waitFor(() => expect(callsOf(fetchMock, BACKLOG_QUERY)).toHaveLength(3));
    expect(callsOf(fetchMock, BACKLOG_QUERY).at(-1)!.variables).toEqual({
      projectId: PROJECT_ID,
      search: 'launch',
      page: 1,
      pageSize: 20,
    });
  });
});

describe('Pagination', () => {
  it('says positions are global, and moves past the loaded rows using the backend’s own item at that place', async () => {
    const pageOne = many(1, 20);
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      // The item now at place 24, read from the backend, one item per page.
      page([item(24, 'Backlog task 24', 'MEDIUM')], { totalCount: 25, pageNumber: 24, pageSize: 1, hasNextPage: true }),
      rankOk(2),
      page([pageOne[0], ...pageOne.slice(2), item(21, 'Backlog task 21', 'MEDIUM')], { totalCount: 25, hasNextPage: true }),
    );
    expect(screen.getByTestId('backlog-range')).toHaveTextContent('Showing 1–20 of 25 items. Positions are global.', { exact: false });

    await fireEvent.press(within(await openActions(2)).getByTestId('action-move-to'));
    await fireEvent.changeText(screen.getByTestId('position-input'), '24');
    expect(screen.getByTestId('position-hint')).toHaveTextContent('Move this item to position 24 of 25.', { exact: false });
    await fireEvent.press(screen.getByTestId('move-item'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(ORDER_SAVED, { exact: false });
    const lookups = callsOf(fetchMock, BACKLOG_QUERY);
    expect(lookups[1].variables).toEqual({ projectId: PROJECT_ID, page: 24, pageSize: 1 });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: idOf(2), afterTaskId: idOf(24) } });
    // TES-2 isn't among the loaded rows any more; nothing is repeated.
    expect(keys()).not.toContain('TES-2');
    expect(new Set(keys()).size).toBe(keys().length);
  });

  it('moves the last loaded item down across the page boundary, after the first item of the next page', async () => {
    const pageOne = many(1, 20);
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      page([item(21, 'Backlog task 21', 'MEDIUM')], { totalCount: 25, pageNumber: 21, pageSize: 1, hasNextPage: true }),
      rankOk(20),
      page([...pageOne.slice(0, 19), item(21, 'Backlog task 21', 'MEDIUM')], { totalCount: 25, hasNextPage: true }),
    );
    await fireEvent.press(within(await openActions(20)).getByTestId('action-move-down'));

    await screen.findByTestId('success-banner');
    expect(callsOf(fetchMock, BACKLOG_QUERY)[1].variables).toEqual({ projectId: PROJECT_ID, page: 21, pageSize: 1 });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)[0].variables).toEqual({ input: { taskId: idOf(20), afterTaskId: idOf(21) } });
  });

  it('refuses to save when the backend’s item at the target place is the moved item itself (the order changed)', async () => {
    const pageOne = many(1, 20);
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      page([item(20, 'Backlog task 20', 'MEDIUM')], { totalCount: 25, pageNumber: 21, pageSize: 1, hasNextPage: true }),
      page(pageOne, { totalCount: 25, hasNextPage: true }),
    );
    await fireEvent.press(within(await openActions(20)).getByTestId('action-move-down'));

    expect(await screen.findByTestId('backlog-save-error')).toHaveTextContent(ORDER_CHANGED, { exact: false });
    expect(callsOf(fetchMock, RANK_TASK_MUTATION)).toHaveLength(0);
  });

  it('reads every loaded page again after a move, without repeating or losing items', async () => {
    const pageOne = many(1, 20);
    const pageTwo = many(21, 5);
    const reordered = [pageOne[1], pageOne[0], ...pageOne.slice(2)];
    const { fetchMock } = await openBacklog(
      'OWNER',
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      page(pageTwo, { totalCount: 25, pageNumber: 2 }),
      rankOk(2),
      page(reordered, { totalCount: 25, hasNextPage: true }),
      // Page 2 overlaps page 1 by one item, as can happen while others change the order.
      page([reordered[19], ...pageTwo], { totalCount: 25, pageNumber: 2 }),
    );
    await fireEvent.press(screen.getByTestId('load-more'));
    await waitFor(() => expect(keys()).toHaveLength(25));
    expect(screen.queryByTestId('backlog-range')).not.toBeOnTheScreen();

    await fireEvent.press(within(await openActions(2)).getByTestId('action-move-up'));

    await screen.findByTestId('success-banner');
    expect(callsOf(fetchMock, BACKLOG_QUERY).slice(-2).map((c) => c.variables.page)).toEqual([1, 2]);
    expect(keys()).toHaveLength(25);
    expect(new Set(keys()).size).toBe(25);
    expect(keys().slice(0, 3)).toEqual(['TES-2', 'TES-1', 'TES-3']);
  });
});

describe('Rules', () => {
  it('lets only writers and owners manage the backlog', () => {
    expect(canManageBacklog('OWNER')).toBe(true);
    expect(canManageBacklog('WRITER')).toBe(true);
    expect(canManageBacklog('READER')).toBe(false);
    expect(canManageBacklog(null)).toBe(false);
  });

  it('turns a target place into the place of the task it goes after', () => {
    expect(anchorPosition(2, 1)).toBe(0); // to the top
    expect(anchorPosition(3, 2)).toBe(1); // up: after the one before the target
    expect(anchorPosition(1, 2)).toBe(2); // down: after the one now at the target
    expect(anchorPosition(2, 24)).toBe(24);
  });

  it('validates a typed position', () => {
    expect(positionError('', 2, 3)).toBe('Enter a position.');
    expect(positionError('1.5', 2, 3)).toBe('Enter a whole number from 1 to 3.');
    expect(positionError('0', 2, 3)).toBe('Enter a position from 1 to 3.');
    expect(positionError('2', 2, 3)).toBe('This item is already at position 2.');
    expect(positionError(' 3 ', 2, 3)).toBeNull();
  });

  it('finds where a dragged row lands, and previews a move without losing items', () => {
    const rows = ['a', 'b', 'c'].map((id, i) => ({ id, y: i * 80, height: 70 }));
    expect(dropIndex(rows, 'a', 170)).toBe(2);
    expect(dropIndex(rows, 'c', -100)).toBe(1);
    expect(dropIndex(rows, 'b', 5)).toBe(1);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
});

