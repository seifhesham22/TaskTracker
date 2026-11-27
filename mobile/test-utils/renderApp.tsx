import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import NotFoundScreen from '../src/app/+not-found';
import RootLayout from '../src/app/_layout';
import BoardsScreen from '../src/app/boards/index';
import ProjectsScreen from '../src/app/index';
import LoginScreen from '../src/app/login';
import RegisterScreen from '../src/app/register';
import EditTaskScreen from '../src/app/tasks/[taskId]/edit';
import TaskDetailsScreen from '../src/app/tasks/[taskId]/index';
import CreateSubtaskScreen from '../src/app/tasks/[taskId]/subtask';
import TaskDependenciesScreen from '../src/app/tasks/[taskId]/dependencies';
import TaskAssigneeScreen from '../src/app/tasks/[taskId]/assignee';
import TaskStatusScreen from '../src/app/tasks/[taskId]/status';
import ProjectBacklogScreen from '../src/app/projects/[projectId]/backlog';
import TeamWorkloadScreen from '../src/app/projects/[projectId]/workload/index';
import MemberWorkloadScreen from '../src/app/projects/[projectId]/workload/member/[userId]';
import UnassignedWorkScreen from '../src/app/projects/[projectId]/workload/unassigned';
import ProjectScreen from '../src/app/projects/[projectId]/index';
import CreateBoardScreen from '../src/app/projects/[projectId]/boards/new';
import AddMemberScreen from '../src/app/projects/[projectId]/members/add';
import ProjectMembersScreen from '../src/app/projects/[projectId]/members/index';
import RemoveMemberScreen from '../src/app/projects/[projectId]/members/remove';
import CreateProjectScreen from '../src/app/projects/new';
import type { Session } from '../src/auth/session';
import { SESSION_KEY } from '../src/auth/sessionStorage';
import { ACCESS_TOKEN, FAR_FUTURE, USER_ID } from './fakeBackend';

export const EMAIL = 'admin@local.test';
// A made-up value for tests only, never a real account's password.
export const PASSWORD = 'Test@Pass12345';

export const loginPayload = (overrides: Partial<{ accessToken: string; expiresAt: string }> = {}) => ({
  body: {
    data: {
      login: {
        accessToken: ACCESS_TOKEN,
        tokenType: 'Bearer',
        expiresAt: FAR_FUTURE,
        user: { id: USER_ID, email: EMAIL },
        ...overrides,
      },
    },
  },
});

export const meResponse = () => ({ body: { data: { me: { id: USER_ID, email: EMAIL } } } });
export const logoutResponse = () => ({ body: { data: { logout: true } } });

export const storedSession = (overrides: Partial<Session> = {}): Record<string, string> => ({
  [SESSION_KEY]: JSON.stringify({
    accessToken: ACCESS_TOKEN,
    expiresAt: FAR_FUTURE,
    user: { id: USER_ID, email: EMAIL },
    ...overrides,
  }),
});

type Routes = Parameters<typeof renderRouter>[0];

/**
 * The whole app as it runs: the real root layout with its auth guard, and the real screens. The
 * board screen is a stand-in unless `routes` provides it.
 */
export async function renderApp(initialUrl = '/', routes: Record<string, unknown> = {}) {
  return renderRouter(
    {
      _layout: RootLayout,
      index: ProjectsScreen,
      login: LoginScreen,
      register: RegisterScreen,
      'boards/index': BoardsScreen,
      'boards/[boardId]': () => <Text>Board screen</Text>,
      'tasks/[taskId]/index': TaskDetailsScreen,
      'tasks/[taskId]/edit': EditTaskScreen,
      'tasks/[taskId]/subtask': CreateSubtaskScreen,
      'tasks/[taskId]/dependencies': TaskDependenciesScreen,
      'tasks/[taskId]/assignee': TaskAssigneeScreen,
      'tasks/[taskId]/status': TaskStatusScreen,
      'projects/new': CreateProjectScreen,
      'projects/[projectId]/index': ProjectScreen,
      'projects/[projectId]/boards/new': CreateBoardScreen,
      'projects/[projectId]/members/index': ProjectMembersScreen,
      'projects/[projectId]/members/add': AddMemberScreen,
      'projects/[projectId]/members/remove': RemoveMemberScreen,
      'projects/[projectId]/backlog': ProjectBacklogScreen,
      'projects/[projectId]/workload/index': TeamWorkloadScreen,
      'projects/[projectId]/workload/member/[userId]': MemberWorkloadScreen,
      'projects/[projectId]/workload/unassigned': UnassignedWorkScreen,
      '+not-found': NotFoundScreen,
      ...routes,
    } as Routes,
    { initialUrl },
  );
}
