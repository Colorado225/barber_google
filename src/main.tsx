import { createRoot } from 'react-dom/client';
import './index.css';
import { AppRouter } from './router';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>,
);
