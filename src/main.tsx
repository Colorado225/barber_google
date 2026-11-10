import { createRoot } from 'react-dom/client';
import './index.css';
import { AppRouter } from './router';
import { AuthProvider } from './context/AuthContext';
import { applyStrictPortalPrivacy, loadMarketplaceFontsIfAllowed } from './lib/portalIsolation';

if (typeof window !== 'undefined') {
  const pathname = window.location.pathname;
  if (!loadMarketplaceFontsIfAllowed(pathname)) {
    applyStrictPortalPrivacy();
  }
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>,
);
