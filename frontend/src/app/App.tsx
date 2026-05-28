import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AppErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppErrorBoundary>
          <RouterProvider router={router} />
        </AppErrorBoundary>
        <Toaster />
      </DataProvider>
    </AuthProvider>
  );
}
