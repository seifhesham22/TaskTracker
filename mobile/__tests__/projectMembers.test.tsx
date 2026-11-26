import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, BackHandler } from 'react-native';

import { PROJECTS_QUERY, type ProjectNode } from '../src/api/boards';
import { ADD_PROJECT_MEMBER_MUTATION, REMOVE_PROJECT_MEMBER_MUTATION } from '../src/api/members';
import { setSession } from '../src/auth/session';
import {
  LAST_OWNER,
  MEMBERS_REFRESH_FAILED,
  NO_ACCOUNT_FOUND,
  ONLY_OWNER_MANAGES,
  SEARCHING_ACCOUNTS,
  SEARCH_FAILED,
  SELECTED_ACCOUNT,
  SELECTED_BY_EMAIL,
  addFailed,
  alreadyMember,
  ownerRoleRefused,
  removeFailed,
  removeUnknown,
} from '../src/domain/members';
import {
  ACCESS_TOKEN,
  API_URL,
  type FakeResponse,
  USER_ID,
  gqlError,
  mockFetch,
  projectsResponse,
} from '../test-utils/fakeBackend';
import { EMAIL, meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const PROJECT = 'p-redesign';
const MINA = 'mina@local.test';
type Member = { userId: string; userName: string; role: string };
const ME = (role = 'OWNER'): Member => ({
  userId: USER_ID,
  userName: EMAIL,
  role,
});
const SEIF: Member = {
  userId: 'u-seif',
  userName: 'seif@local.test',
  role: 'WRITER',
};
const RITA: Member = {
  userId: 'u-rita',
  userName: 'rita@local.test',
  role: 'READER',
};
const OWNER: Member = {
  userId: 'u-owner',
  userName: 'dombele@local.test',
  role: 'OWNER',
};
const mina = (role = 'WRITER'): Member => ({
  userId: 'u-mina',
  userName: MINA,
  role,
});

const read = (members: Member[], myRole = 'OWNER'): FakeResponse => {
  const project: ProjectNode = {
    id: PROJECT,
    name: 'Website redesign',
    role: myRole,
    boards: [],
    projectMembers: members,
  };
  return projectsResponse([project]);
};
const TEAM = [ME(), SEIF, RITA];
/** What the account search reads: the user's projects, one of them shared with Mina. */
const searchRead = (members: Member[] = TEAM): FakeResponse => {
  const redesign: ProjectNode = {
    id: PROJECT,
    name: 'Website redesign',
    role: 'OWNER',
    boards: [],
    projectMembers: members,
  };
  const other: ProjectNode = {
    id: 'p-app',
    name: 'Mobile app',
    role: 'WRITER',
    boards: [],
    projectMembers: [OWNER, ME('WRITER'), mina('READER')],
  };
  return projectsResponse([redesign, other]);
};
const added = (role = 'WRITER') => ({
  body: { data: { addProjectMember: { projectId: PROJECT, ...mina(role) } } },
});
const removed = () => ({
  body: { data: { removeProjectMember: { projectId: PROJECT, ...SEIF } } },
});
const serverError: FakeResponse = {
  status: 500,
  body: { errors: [{ message: 'Unexpected Execution Error' }] },
};

type Sent = { query: string; variables: { input?: Record<string, unknown> } };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const inputs = (fetchMock: jest.Mock, query: string) =>
  sent(fetchMock)
    .filter((b) => b.query === query)
    .map((b) => b.variables.input);
const addInputs = (fetchMock: jest.Mock) => inputs(fetchMock, ADD_PROJECT_MEMBER_MUTATION);
const removeInputs = (fetchMock: jest.Mock) => inputs(fetchMock, REMOVE_PROJECT_MEMBER_MUTATION);

const membersUrl = `/projects/${PROJECT}/members`;

async function open(url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url);
  return { router, fetchMock };
}

/** Project members, then Add member. Each screen reads the members. */
async function openAdd(...responses: FakeResponse[]) {
  const opened = await open(membersUrl, read(TEAM), read(TEAM), ...responses);
  await fireEvent.press(await screen.findByTestId('add-member-button'));
  await screen.findByTestId('account-input');
  return opened;
}

/** Project members, then Remove member of Seif. */
async function openRemove(...responses: FakeResponse[]) {
  const opened = await open(membersUrl, read(TEAM), read(TEAM), ...responses);
  await fireEvent.press(await screen.findByTestId('remove-u-seif'));
  await screen.findByTestId('confirm-remove');
  return opened;
}

const type = (email: string) => fireEvent.changeText(screen.getByTestId('account-input'), email);
const submit = () => fireEvent.press(screen.getByTestId('add-member-submit'));
/** Searches for `term` and selects `name` among the accounts found. */
async function pick(term: string, name = MINA) {
  await type(term);
  await fireEvent.press(await screen.findByTestId(`account-option-${name}`));
  await screen.findByTestId('selected-account');
}
async function chooseRole(role: string) {
  await fireEvent.press(screen.getByTestId('role-select'));
  await fireEvent.press(screen.getByTestId(`role-${role}`));
  await fireEvent.press(screen.getByTestId('role-done'));
}
const confirm = () => fireEvent.press(screen.getByTestId('confirm-remove'));
const pendingFetch = () => {
  let answer!: (value: unknown) => void;
  const fetchMock = jest.fn(() => new Promise((resolve) => (answer = resolve)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const respond = (body: unknown) => answer({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  return { fetchMock, respond };
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Project members', () => {
  it('opens from the project list and shows every member with their role', async () => {
    const { router, fetchMock } = await open('/', read(TEAM), read(TEAM));
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Members of Website redesign',
      }),
    );

    await waitFor(() => expect(router).toHavePathname(membersUrl));
    expect(await screen.findByText('Website redesign · Owner view')).toBeOnTheScreen();
    const me = screen.getByTestId(`member-${USER_ID}`);
    expect(within(me).getByText(`${EMAIL} (you)`)).toBeOnTheScreen();
    expect(within(me).getByText('Owner · Last Owner')).toBeOnTheScreen();
    expect(within(screen.getByTestId('member-u-seif')).getByText('Writer')).toBeOnTheScreen();
    expect(within(screen.getByTestId('member-u-rita')).getByText('Reader')).toBeOnTheScreen();
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);
  });

  it('offers the Owner Add and Remove, but never removing the Owner', async () => {
    await open(membersUrl, read(TEAM));

    expect(await screen.findByRole('button', { name: 'Add member' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove seif@local.test' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove rita@local.test' })).toBeOnTheScreen();
    expect(screen.queryByTestId(`remove-${USER_ID}`)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('owner-only-note')).not.toBeOnTheScreen();
  });

  it.each([
    ['WRITER', 'Writer'],
    ['READER', 'Reader'],
  ])('shows a %s the members without any management action', async (role, label) => {
    await open(membersUrl, read([OWNER, ME(role), SEIF], role));

    expect(await screen.findByText(`Website redesign · ${label} view`)).toBeOnTheScreen();
    expect(screen.getByTestId('owner-only-note')).toHaveTextContent(ONLY_OWNER_MANAGES);
    expect(screen.getByTestId('member-u-seif')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeOnTheScreen();
    expect(screen.queryAllByText('Remove member')).toHaveLength(0);
  });

  it.each(['add', 'remove?userId=u-seif'])('doesn’t let a Writer use %s by link', async (path) => {
    const { fetchMock } = await open(`${membersUrl}/${path}`, read([OWNER, ME('WRITER'), SEIF], 'WRITER'));

    expect(await screen.findByText(ONLY_OWNER_MANAGES)).toBeOnTheScreen();
    expect(screen.queryByTestId('account-input')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('confirm-remove')).not.toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows loading, then an error that can be retried', async () => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const ok = (body: unknown) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    });
    const queue = [async () => ok(meResponse().body), () => new Promise((resolve) => (answer = resolve))];
    globalThis.fetch = jest.fn(() => queue.shift()!()) as unknown as typeof fetch;
    await renderApp(membersUrl);
    // Nothing of the project, not even its name, until the backend answers.
    expect(await screen.findByTestId('access-checking')).toBeOnTheScreen();
    expect(screen.getByText('Loading your permitted workspace…')).toBeOnTheScreen();
    expect(screen.queryByText(/Website redesign/)).not.toBeOnTheScreen();

    await act(async () => answer({ ok: false, status: 500, text: async () => '' }));
    // An HTTP 500 is the server's problem: neither a refusal nor a lost connection.
    expect(await screen.findByRole('header', { name: 'Couldn’t check access' })).toBeOnTheScreen();
    expect(screen.queryByText('Check your connection and try again.')).not.toBeOnTheScreen();
    mockFetch(read(TEAM));
    await fireEvent.press(screen.getByTestId('access-retry'));
    expect(await screen.findByTestId('member-u-seif')).toBeOnTheScreen();
  });

  it('shows an empty list', async () => {
    await open(membersUrl, read([]));
    expect(await screen.findByText('This project has no members yet.')).toBeOnTheScreen();
  });

  it('says so when the user isn’t a member of the project any more', async () => {
    await open(membersUrl, projectsResponse([]));
    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.getByText('Return to your projects. If you need access, contact a project Owner.')).toBeOnTheScreen();
  });
});

describe('Add a member', () => {
  it('renders the form with Add disabled until an account is selected', async () => {
    await openAdd();

    expect(screen.getByRole('header', { name: 'Add a member' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign · Existing accounts only')).toBeOnTheScreen();
    expect(screen.getByText('Find an account *')).toBeOnTheScreen();
    expect(screen.getByLabelText('Find an account, required')).toBeOnTheScreen();
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeEnabled();
    expect(screen.queryByTestId('role-select')).not.toBeOnTheScreen();
  });

  it('announces the search, keeps the query, prevents adding, and then lists the accounts found', async () => {
    const { fetchMock } = await openAdd(searchRead());
    await type('mina');

    expect(screen.getByTestId('account-searching')).toHaveTextContent(SEARCHING_ACCOUNTS);
    expect(screen.queryByTestId('account-none')).not.toBeOnTheScreen();
    expect(screen.getByTestId('account-input').props.value).toBe('mina');
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeEnabled();

    const option = await screen.findByTestId(`account-option-${MINA}`);
    expect(option).toHaveTextContent(/mina@local\.test.*Existing account/);
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    // The search reads the backend: the accounts in the user's own projects.
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);

    await fireEvent.press(option);
    expect(screen.getByTestId('selected-account')).toHaveTextContent(`${MINA}${SELECTED_ACCOUNT}`);
    expect(screen.getByTestId('role-select')).toHaveTextContent('Writer');
    expect(screen.getByTestId('add-member-submit')).toBeEnabled();
    expect(addInputs(fetchMock)).toHaveLength(0);
  });

  it('searches once typing stops', async () => {
    const { fetchMock } = await openAdd(searchRead());
    const before = fetchMock.mock.calls.length;
    await type('m');
    await type('mi');
    await type('min');
    await screen.findByTestId(`account-option-${MINA}`);
    expect(fetchMock).toHaveBeenCalledTimes(before + 1);
  });

  it('offers Owner, Writer and Reader, with Writer proposed', async () => {
    await openAdd(searchRead());
    await pick('mina');
    await fireEvent.press(screen.getByTestId('role-select'));

    const sheet = screen.getByTestId('role-sheet');
    expect(within(sheet).getByRole('header', { name: 'Project role' })).toBeOnTheScreen();
    expect(within(sheet).getByText(`Choose ${MINA}’s access to this project.`)).toBeOnTheScreen();
    expect(
      within(sheet)
        .getAllByRole('radio')
        .map((r) => r.props.accessibilityLabel),
    ).toEqual([
      'Owner, Manage the project and its members',
      'Writer, Create and update project work',
      'Reader, View permitted project work',
    ]);
    expect(screen.getByTestId('role-WRITER').props.accessibilityState).toMatchObject({ checked: true });

    // Closing without Done keeps the role.
    await fireEvent.press(screen.getByTestId('role-OWNER'));
    await fireEvent.press(screen.getByTestId('role-close'));
    expect(screen.getByTestId('role-select')).toHaveTextContent('Writer');
    expect(screen.getByTestId('selected-account')).toHaveTextContent(/mina@local.test/);
  });

  it('shows “No accounts found” only after a search with no results, and keeps Add disabled', async () => {
    const { fetchMock } = await openAdd(searchRead());
    await type('nobody');

    expect(await screen.findByTestId('account-none')).toHaveTextContent(NO_ACCOUNT_FOUND);
    expect(screen.getByTestId('account-input').props.value).toBe('nobody');
    expect(screen.getByTestId('account-input').props.editable).toBe(true);
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    expect(addInputs(fetchMock)).toHaveLength(0);
  });

  it('marks an account that is already a member and lets the Owner choose another', async () => {
    const { fetchMock } = await openAdd(searchRead(), searchRead());
    await type('seif');
    const option = await screen.findByTestId('account-option-seif@local.test');
    expect(option).toHaveTextContent(/Already a project member/);
    await fireEvent.press(option);

    expect(screen.getByTestId('form-error')).toHaveTextContent(alreadyMember('seif@local.test'));
    expect(screen.queryByTestId('add-member-submit')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('role-select')).not.toBeOnTheScreen();
    expect(addInputs(fetchMock)).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('choose-another'));
    expect(screen.getByTestId('account-input').props.value).toBe('');
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    await pick('mina');
    expect(screen.getByTestId('add-member-submit')).toBeEnabled();
  });

  it('shows the backend’s duplicate refusal the same way', async () => {
    await openAdd(searchRead(), {
      body: gqlError('BAD_USER_INPUT', `${MINA} is already a member of this project.`),
    });
    await pick('mina');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(alreadyMember(MINA));
    expect(screen.getByTestId('choose-another')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-member-submit')).not.toBeOnTheScreen();
  });

  it.each([
    ['WRITER', 'Writer'],
    ['READER', 'Reader'],
  ])('adds the selected account as a %s and shows the list read again from the backend', async (role, label) => {
    const { router, fetchMock } = await openAdd(searchRead(), added(role), read([...TEAM, mina(role)]));
    await pick('mina');
    await chooseRole(role);
    await submit();

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(`${MINA} added as a ${label}.`);
    expect(router).toHavePathname(membersUrl);
    expect(within(await screen.findByTestId('member-u-mina')).getByText(label)).toBeOnTheScreen();
    expect(addInputs(fetchMock)).toEqual([{ projectId: PROJECT, email: MINA, role }]);
    const index = sent(fetchMock).findIndex((b) => b.query === ADD_PROJECT_MEMBER_MUTATION);
    expect(((fetchMock.mock.calls[index][1] as RequestInit).headers as Headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    expect(sent(fetchMock)[index + 1].query).toBe(PROJECTS_QUERY);
  });

  it('sends Owner to the backend and explains its one-Owner rule, keeping the selection', async () => {
    const oneOwner = {
      body: gqlError('BAD_USER_INPUT', 'A project has only one owner. New members can be readers or writers.'),
    };
    const { fetchMock } = await openAdd(searchRead(), oneOwner, added('WRITER'), read([...TEAM, mina()]));
    await pick('mina');
    await chooseRole('OWNER');
    expect(screen.getByTestId('role-select')).toHaveTextContent('Owner');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(ownerRoleRefused(MINA));
    expect(screen.getByTestId('selected-account')).toHaveTextContent(/mina@local.test/);
    expect(screen.getByTestId('role-select')).toHaveTextContent('Owner');
    expect(addInputs(fetchMock)).toEqual([{ projectId: PROJECT, email: MINA, role: 'OWNER' }]);

    await chooseRole('WRITER');
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
    await submit();
    expect(await screen.findByText(`${MINA} added as a Writer.`)).toBeOnTheScreen();
    expect(addInputs(fetchMock).at(-1)).toEqual({
      projectId: PROJECT,
      email: MINA,
      role: 'WRITER',
    });
  });

  it('offers a full email the search can’t see, and the backend checks the account exists', async () => {
    const email = 'new.person@local.test';
    const noAccount = {
      body: gqlError('NOT_FOUND', `No account with the email '${email}' was found.`),
    };
    const { router, fetchMock } = await openAdd(searchRead(), noAccount);
    await type(email);
    const option = await screen.findByTestId(`account-option-${email}`);
    expect(option).toHaveTextContent(/checked when you add/);
    await fireEvent.press(option);
    expect(screen.getByTestId('selected-account')).toHaveTextContent(`${email}${SELECTED_BY_EMAIL}`);
    await submit();

    expect(await screen.findByTestId('account-none')).toHaveTextContent(NO_ACCOUNT_FOUND);
    expect(screen.getByTestId('account-input').props.value).toBe(email);
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    expect(screen.queryByText(/added as a/)).not.toBeOnTheScreen();
    expect(router).toHavePathname(`${membersUrl}/add`);
    expect(addInputs(fetchMock)).toEqual([{ projectId: PROJECT, email, role: 'WRITER' }]);
  });

  it('explains a failed search and searches again', async () => {
    await openAdd('network-error', searchRead());
    await type('mina');

    expect(await screen.findByTestId('account-search-error')).toHaveTextContent(SEARCH_FAILED);
    expect(screen.queryByTestId('account-none')).not.toBeOnTheScreen();
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('account-search-retry'));
    expect(await screen.findByTestId(`account-option-${MINA}`)).toBeOnTheScreen();
  });

  it('never invents the new member when the list can’t be refreshed', async () => {
    await openAdd(searchRead(), added(), 'network-error', read([...TEAM, mina()]));
    await pick('mina');
    await submit();

    expect(await screen.findByTestId('members-refresh-error')).toHaveTextContent(MEMBERS_REFRESH_FAILED);
    expect(screen.getByTestId('member-u-seif')).toBeOnTheScreen();
    expect(screen.queryByTestId('member-u-mina')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('members-refresh'));
    expect(await screen.findByTestId('member-u-mina')).toBeOnTheScreen();
  });

  it('shows any other refusal as the backend explains it', async () => {
    const message = 'Only writers and owners of the project can add members.';
    await openAdd(searchRead(), {
      body: gqlError('AUTH_NOT_AUTHORIZED', message),
    });
    await pick('mina');
    await submit();
    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
  });

  it.each([
    ['no response', 'network-error' as FakeResponse],
    ['a server error', serverError],
  ])('keeps the selection after %s, adds nobody, and can retry', async (_, failure) => {
    const { router, fetchMock } = await openAdd(
      searchRead(),
      failure,
      read(TEAM),
      added('READER'),
      read([...TEAM, mina('READER')]),
    );
    await pick('mina');
    await chooseRole('READER');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(addFailed(MINA));
    expect(screen.queryByTestId('success-banner')).not.toBeOnTheScreen();
    expect(router).toHavePathname(`${membersUrl}/add`);
    expect(screen.getByTestId('selected-account')).toHaveTextContent(/mina@local.test/);
    expect(screen.getByTestId('role-select')).toHaveTextContent('Reader');
    expect(screen.getByTestId('add-member-submit')).toBeEnabled();
    expect(screen.getByTestId('cancel-button')).toBeEnabled();

    await submit();
    expect(await screen.findByText(`${MINA} added as a Reader.`)).toBeOnTheScreen();
    expect(addInputs(fetchMock)).toHaveLength(2);
  });

  it('finds out on retry that the first attempt was saved, and doesn’t send it again', async () => {
    const { fetchMock } = await openAdd(
      searchRead(),
      'network-error',
      read([...TEAM, mina()]),
      read([...TEAM, mina()]),
    );
    await pick('mina');
    await submit();
    await screen.findByTestId('form-error');
    await submit();

    expect(await screen.findByText(`${MINA} added as a Writer.`)).toBeOnTheScreen();
    expect(addInputs(fetchMock)).toHaveLength(1);
  });

  it('shows “Adding…”, keeps the account and role visible, locks the form and Back, and sends one request', async () => {
    const onBack = jest.spyOn(BackHandler, 'addEventListener');
    await openAdd(searchRead());
    await pick('mina');
    const { fetchMock, respond } = pendingFetch();
    onBack.mockClear();
    await submit();
    await submit();

    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByTestId('add-member-submit')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('role-select')).toBeDisabled();
    expect(screen.getByTestId('role-select')).toHaveTextContent('Writer');
    expect(screen.getByTestId('selected-account')).toHaveTextContent(/mina@local.test/);
    expect(screen.getByText('Website redesign · Existing accounts only')).toBeOnTheScreen();
    expect(screen.getByTestId('account-input').props.editable).toBe(false);
    expect(screen.queryByTestId('success-banner')).not.toBeOnTheScreen();
    expect(onBack.mock.calls.some(([event]) => event === 'hardwareBackPress')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockFetch(read([...TEAM, mina()]));
    await act(async () => respond(added().body));
    expect(await screen.findByText(`${MINA} added as a Writer.`)).toBeOnTheScreen();
    onBack.mockRestore();
  });

  it('Cancel goes back without adding anyone', async () => {
    const { router, fetchMock } = await openAdd(searchRead(), read(TEAM));
    await pick('mina');
    await fireEvent.press(screen.getByTestId('cancel-button'));

    await waitFor(() => expect(router).toHavePathname(membersUrl));
    expect(addInputs(fetchMock)).toHaveLength(0);
  });
});

describe('Remove a member', () => {
  it('asks first, naming the account and the project, and Keep member changes nothing', async () => {
    const { router, fetchMock } = await openRemove(read(TEAM));

    expect(screen.getByRole('header', { name: 'Remove seif@local.test?' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign')).toBeOnTheScreen();
    expect(screen.getByText(/seif@local\.test will lose access to this project’s boards and tasks/)).toBeOnTheScreen();
    expect(removeInputs(fetchMock)).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('keep-member'));
    await waitFor(() => expect(router).toHavePathname(membersUrl));
    expect(screen.getByTestId('member-u-seif')).toBeOnTheScreen();
    expect(removeInputs(fetchMock)).toHaveLength(0);
  });

  it('puts initial focus on Keep member, the safe action', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await openRemove();
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    focus.mockRestore();
  });

  it('removes the member with the real mutation and shows the list read again', async () => {
    const { router, fetchMock } = await openRemove(removed(), read([ME(), RITA]));
    await confirm();

    expect(await screen.findByText('seif@local.test removed. Project access revoked.')).toBeOnTheScreen();
    expect(router).toHavePathname(membersUrl);
    await waitFor(() => expect(screen.queryByTestId('member-u-seif')).not.toBeOnTheScreen());
    expect(screen.getByTestId('member-u-rita')).toBeOnTheScreen();
    expect(removeInputs(fetchMock)).toEqual([{ projectId: PROJECT, userId: 'u-seif' }]);
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);
  });

  it('shows “Removing…”, locks Back, and sends one request', async () => {
    await openRemove();
    const { fetchMock, respond } = pendingFetch();
    await confirm();
    await confirm();

    expect(screen.getByText('Removing…')).toBeOnTheScreen();
    expect(screen.getByTestId('confirm-remove')).toBeDisabled();
    expect(screen.getByTestId('keep-member')).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockFetch(read([ME(), RITA]));
    await act(async () => respond(removed().body));
    expect(await screen.findByText(/removed\. Project access revoked/)).toBeOnTheScreen();
  });

  it.each([
    ['no response', 'network-error' as FakeResponse],
    ['a server error', serverError],
  ])('after %s says they are still a member, keeps them listed, and can retry', async (_, failure) => {
    const { fetchMock } = await openRemove(failure, read(TEAM), removed(), read([ME(), RITA]));
    await confirm();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(removeFailed('seif@local.test'));
    expect(screen.queryByText(/Project access revoked/)).not.toBeOnTheScreen();

    await confirm();
    expect(await screen.findByText(/Project access revoked/)).toBeOnTheScreen();
    expect(removeInputs(fetchMock)).toHaveLength(2);
  });

  it('keeps the member in the list after a failed removal', async () => {
    const { router } = await openRemove('network-error', read(TEAM), read(TEAM));
    await confirm();
    await screen.findByTestId('form-error');
    await fireEvent.press(screen.getByTestId('keep-member'));

    await waitFor(() => expect(router).toHavePathname(membersUrl));
    expect(screen.getByTestId('member-u-seif')).toBeOnTheScreen();
  });

  it('recognises a removal that was saved although the answer was lost', async () => {
    await openRemove('network-error', read([ME(), RITA]), read([ME(), RITA]));
    await confirm();
    expect(await screen.findByText(/Project access revoked/)).toBeOnTheScreen();
  });

  it('claims neither outcome when it can’t be checked', async () => {
    await openRemove('network-error', 'network-error');
    await confirm();
    expect(await screen.findByTestId('form-error')).toHaveTextContent(removeUnknown('seif@local.test'));
  });

  it('treats a member someone else removed first as removed', async () => {
    const gone = {
      body: gqlError('NOT_FOUND', "User 'u-seif' is not a member of this project."),
    };
    await openRemove(gone, read([ME(), RITA]));
    await confirm();
    expect(await screen.findByText(/Project access revoked/)).toBeOnTheScreen();
  });

  it('explains the backend’s Owner protection, and nothing was removed', async () => {
    const refused = {
      body: gqlError('BAD_USER_INPUT', "seif@local.test is the owner of this project and can't be removed."),
    };
    const { router } = await openRemove(refused, read(TEAM));
    await confirm();

    expect(await screen.findByRole('header', { name: 'Owner required' })).toBeOnTheScreen();
    expect(screen.getByTestId('form-error')).toHaveTextContent(LAST_OWNER);
    expect(screen.getByText(/No membership was changed/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('back-to-members'));
    await waitFor(() => expect(router).toHavePathname(membersUrl));
    expect(screen.getByTestId('member-u-seif')).toBeOnTheScreen();
  });

  it('doesn’t let the Owner remove themselves by link', async () => {
    const { fetchMock } = await open(`${membersUrl}/remove?userId=${USER_ID}`, read(TEAM));
    expect(await screen.findByTestId('owner-required')).toBeOnTheScreen();
    expect(screen.queryByTestId('confirm-remove')).not.toBeOnTheScreen();
    expect(removeInputs(fetchMock)).toHaveLength(0);
  });

  it('shows a lost permission and offers no retry', async () => {
    const message = 'Only writers and owners of the project can remove members.';
    await openRemove({ body: gqlError('AUTH_NOT_AUTHORIZED', message) });
    await confirm();
    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(screen.queryByTestId('confirm-remove')).not.toBeOnTheScreen();
    expect(screen.getByTestId('back-to-members')).toBeOnTheScreen();
  });
});
