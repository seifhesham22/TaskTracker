import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '../auth/AuthContext';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
