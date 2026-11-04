import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CreateTaskSheet } from '../src/components/createTask/CreateTaskSheet';
import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import {
  GENERAL_ERROR_TITLE,
  NETWORK_ERROR_DESCRIPTION,
  SERVER_ERROR_DESCRIPTION,
  TITLE_REQUIRED,
} from '../src/domain/createTaskErrors';
import type { Task } from '../src/domain/models';
import { SCROLL_MARGIN, useCreateTaskForm } from '../src/hooks/useCreateTaskForm';
import { API_URL, BOARD_ID, MEMBERS, boardData, gqlError, gqlTask, mockFetch, sentBody, taskDto } from '../test-utils/fakeBackend';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const Picker = ({ onChange, testID }: { onChange: (e: { type: string }, d: Date) => void; testID?: string }) =>
    React.createElement(
      Pressable,
      { testID, onPress: () => onChange({ type: 'set' }, new Date(2026, 10, 3)) },
      React.createElement(Text, null, 'Pick Nov 3'),
    );
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const NOT_A_MEMBER = `User '${MEMBERS[0].userId}' is not a member of project TES, so they can't be assigned to this task.`;
const NOT_A_MEMBER_SHOWN = 'Mona Adel isn’t a member of Test Project, so they can’t be assigned. Pick someone from this project.';

const scrollTo = (ScrollView.prototype as unknown as { scrollTo: jest.Mock }).scrollTo;
const formScrolls = () =>
  scrollTo.mock.calls
    .filter((_, i) => (scrollTo.mock.contexts[i] as { props?: { testID?: string } })?.props?.testID === 'create-task-scroll')
    .map(([options]) => options);

async function renderSheet() {
  const callbacks = { onClose: jest.fn(), onCreated: jest.fn(), onBoardNotFound: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CreateTaskSheet board={boardData().board} createTask={createBackendBoardRepository().createTask} {...callbacks} />
    </SafeAreaProvider>,
  );
  return callbacks;
}

const titleInput = () => screen.getByTestId('title-input');
const submit = () => fireEvent.press(screen.getByTestId('submit-button'));

async function chooseAssignee(userId: string) {
  await fireEvent.press(screen.getByTestId('assignee-select'));
  await fireEvent.press(screen.getByTestId(`assignee-sheet-option-${userId}`));
}

async function fillEveryField() {
  await fireEvent.changeText(titleInput(), 'Design the board screen');
  await fireEvent.changeText(screen.getByTestId('description-input'), 'Columns scroll sideways.');
  await chooseAssignee(MEMBERS[0].userId);
  await fireEvent.press(screen.getByTestId('priority-select'));
  await fireEvent.press(screen.getByTestId('priority-sheet-option-HIGH'));
  await fireEvent.press(screen.getByTestId('due-date-select'));
  await fireEvent.press(screen.getByTestId('due-date-picker'));
  await fireEvent.press(screen.getByTestId('due-date-done'));
}

function expectEveryFieldKept() {
  expect(titleInput()).toHaveDisplayValue('Design the board screen');
  expect(screen.getByTestId('description-input')).toHaveDisplayValue('Columns scroll sideways.');
  expect(within(screen.getByTestId('assignee-select')).getByText('Mona Adel')).toBeOnTheScreen();
  expect(within(screen.getByTestId('priority-select')).getByText('High')).toBeOnTheScreen();
  expect(within(screen.getByTestId('due-date-select')).getByText('Nov 3, 2026')).toBeOnTheScreen();
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  scrollTo.mockClear();
});

describe('Title validation', () => {
  it.each([
    ['empty', ''],
    ['whitespace-only', '    '],
  ])('shows "Title is required" under Title for an %s title, without sending a request', async (_, title) => {
    const fetchMock = mockFetch();
    await renderSheet();

    await fireEvent.changeText(titleInput(), title);
    await submit();

    expect(within(screen.getByTestId('field-title')).getByText(TITLE_REQUIRED)).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not shown before the first submit', async () => {
    await renderSheet();
    await fireEvent.changeText(titleInput(), ' ');
    expect(screen.queryByText(TITLE_REQUIRED)).not.toBeOnTheScreen();
  });

  it('clears as soon as the title is valid, and comes back if it is emptied again', async () => {
    await renderSheet();
    await submit();
    expect(screen.getByText(TITLE_REQUIRED)).toBeOnTheScreen();

    await fireEvent.changeText(titleInput(), 'A real title');
    expect(screen.queryByText(TITLE_REQUIRED)).not.toBeOnTheScreen();

    await fireEvent.changeText(titleInput(), '  ');
    expect(screen.getByText(TITLE_REQUIRED)).toBeOnTheScreen();
  });

  it('sends the trimmed title', async () => {
    const fetchMock = mockFetch({ body: gqlTask(taskDto()) });
    await renderSheet();
    await fireEvent.changeText(titleInput(), '   Trim me  ');
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).variables.input.title).toBe('Trim me');
  });
});

describe('Assignee error from the server', () => {
  it('shows the design’s message for the rejected member under Assignee, not at the top of the form', async () => {
    const fetchMock = mockFetch({ body: gqlError('BAD_USER_INPUT', NOT_A_MEMBER) });
    await renderSheet();
    await fireEvent.changeText(titleInput(), 'Assign me');
    await chooseAssignee(MEMBERS[0].userId);

    await submit();

    expect(await within(screen.getByTestId('field-assigneeId')).findByText(NOT_A_MEMBER_SHOWN)).toBeOnTheScreen();
    expect(screen.queryByText(NOT_A_MEMBER)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('form-error-alert')).not.toBeOnTheScreen();
    expect(sentBody(fetchMock).variables.input.assigneeId).toBe(MEMBERS[0].userId);
  });

  it('clears when another assignee is chosen', async () => {
    mockFetch({ body: gqlError('BAD_USER_INPUT', NOT_A_MEMBER) });
    await renderSheet();
    await fireEvent.changeText(titleInput(), 'Assign me');
    await chooseAssignee(MEMBERS[0].userId);
    await submit();
    expect(await screen.findByText(NOT_A_MEMBER_SHOWN)).toBeOnTheScreen();

    await chooseAssignee(MEMBERS[1].userId);

    expect(screen.queryByTestId('assignee-error')).not.toBeOnTheScreen();
  });
});

describe('General errors', () => {
  it('shows a network failure at the top and keeps every value', async () => {
    const { onCreated, onClose } = await renderSheet();
    mockFetch('network-error');
    await fillEveryField();

    await submit();

    const alert = await screen.findByTestId('form-error-alert');
    expect(within(alert).getByText(GENERAL_ERROR_TITLE)).toBeOnTheScreen();
    expect(within(alert).getByText(NETWORK_ERROR_DESCRIPTION)).toBeOnTheScreen();
    expectEveryFieldKept();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a server failure at the top, keeps every value and can be retried', async () => {
    const created = taskDto({ title: 'Design the board screen' });
    const fetchMock = mockFetch({ status: 500, body: 'Internal Server Error' }, { body: gqlTask(created) });
    const { onCreated } = await renderSheet();
    await fillEveryField();

    await submit();
    expect(await screen.findByText(SERVER_ERROR_DESCRIPTION)).toBeOnTheScreen();
    expectEveryFieldKept();

    await submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1).variables.input).toEqual(sentBody(fetchMock, 0).variables.input);
    expect(sentBody(fetchMock, 1).variables.input).toEqual({
      boardId: BOARD_ID,
      title: 'Design the board screen',
      description: 'Columns scroll sideways.',
      assigneeId: MEMBERS[0].userId,
      priority: 'HIGH',
      dueDate: '2026-11-03T00:00:00Z',
    });
  });

  it('sends only one request when submit is triggered twice before the first one finishes', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const createTask = jest.fn(async (): Promise<Task> => {
      await gate;
      return taskDto({ title: 'Once' });
    });
    const onCreated = jest.fn();
    const { result } = await renderHook(() =>
      useCreateTaskForm({ boardId: BOARD_ID, createTask, onCreated, onBoardNotFound: jest.fn() }),
    );
    await act(async () => result.current.form.setTitle('Once'));

    await act(async () => {
      const first = result.current.form.submit();
      const second = result.current.form.submit();
      finish();
      await Promise.all([first, second]);
    });

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('reports a deleted board to the board screen instead of showing it in the form', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    const { onBoardNotFound } = await renderSheet();
    await fireEvent.changeText(titleInput(), 'Too late');
    await submit();
    await waitFor(() => expect(onBoardNotFound).toHaveBeenCalledWith(`Board '${BOARD_ID}' was not found.`));
    expect(screen.queryByTestId('form-error-alert')).not.toBeOnTheScreen();
  });
});

describe('Scrolling to the first field with an error', () => {
  async function layOutFields() {
    const layout = (testID: string, y: number) =>
      fireEvent.layout(screen.getByTestId(testID), { x: 0, y, width: 358, height: 72 });
    await layout('field-title', 76);
    await layout('field-description', 168);
    await layout('field-assigneeId', 420);
    await layout('field-priority', 512);
    await layout('field-dueDate', 604);
  }

  it('scrolls to Title when the title is invalid', async () => {
    await renderSheet();
    await layOutFields();
    scrollTo.mockClear();

    await submit();

    expect(formScrolls()).toContainEqual({ y: 76 - SCROLL_MARGIN, animated: true });
  });

  it('scrolls to Assignee when the server rejects the assignee', async () => {
    mockFetch({ body: gqlError('BAD_USER_INPUT', NOT_A_MEMBER) });
    await renderSheet();
    await layOutFields();
    await fireEvent.changeText(titleInput(), 'Assign me');
    await chooseAssignee(MEMBERS[0].userId);
    scrollTo.mockClear();

    await submit();

    await waitFor(() => expect(formScrolls()).toContainEqual({ y: 420 - SCROLL_MARGIN, animated: true }));
  });

  it('scrolls again if the field moves after the errors appear', async () => {
    await renderSheet();
    await layOutFields();
    await submit();
    scrollTo.mockClear();

    await fireEvent.layout(screen.getByTestId('field-title'), { x: 0, y: 20, width: 358, height: 72 });

    expect(formScrolls()).toContainEqual({ y: 4, animated: true });
  });

  it('scrolls to the top for a general error so the alert is visible', async () => {
    mockFetch('network-error');
    await renderSheet();
    await layOutFields();
    await fireEvent.changeText(titleInput(), 'Offline');
    scrollTo.mockClear();

    await submit();

    await waitFor(() => expect(formScrolls()).toContainEqual({ y: 0, animated: true }));
  });
});

describe('Cancel', () => {
  it('closes straight away when nothing was entered', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { onClose } = await renderSheet();
    await fireEvent.press(screen.getByTestId('cancel-button'));
    expect(onClose).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('asks "Discard this task?" when something was entered', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { onClose } = await renderSheet();
    await fireEvent.changeText(titleInput(), 'Half-written');

    await fireEvent.press(screen.getByTestId('cancel-button'));

    expect(alertSpy).toHaveBeenCalledWith('Discard this task?', expect.any(String), expect.any(Array));
    expect(onClose).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2]!;
    buttons.find((b) => b.text === 'Discard')!.onPress!();
    expect(onClose).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
