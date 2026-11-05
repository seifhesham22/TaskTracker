import type { RouteObject } from 'react-router';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { TasksPage } from '../pages/TasksPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <TasksPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'boards/:boardId', element: <TasksPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
