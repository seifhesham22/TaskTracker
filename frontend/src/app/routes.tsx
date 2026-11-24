import type { RouteObject } from 'react-router';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectBacklogPage } from '../pages/ProjectBacklogPage';
import { ProjectMembersPage } from '../pages/ProjectMembersPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TasksPage } from '../pages/TasksPage';

export const routes: RouteObject[] = [
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <TasksPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/:projectId/members', element: <ProjectMembersPage /> },
          { path: 'projects/:projectId/backlog', element: <ProjectBacklogPage /> },
          { path: 'backlog', element: <ProjectBacklogPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'boards/:boardId', element: <TasksPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
