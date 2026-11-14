import type { RouteObject } from 'react-router';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TasksPage } from '../pages/TasksPage';

export const routes: RouteObject[] = [
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
          { path: 'tasks', element: <TasksPage /> },
          { path: 'boards/:boardId', element: <TasksPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
