import React, { Suspense } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import App from './App';
import { SalonProvider } from './context/SalonContext';
import { ToastContainer } from './components/common/ToastContainer';
import { RouteLoadingFallback, lazyNamed } from './components/common/ViewLoader';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';

const SalonPublicPage = lazyNamed(
  () => import('./components/marketplace/salon/SalonPublicPage'),
  'SalonPublicPage',
);
const BookingPortalView = lazyNamed(
  () => import('./components/marketplace/BookingPortalView'),
  'BookingPortalView',
);
const MyBookingsView = lazyNamed(() => import('./components/marketplace/MyBookingsView'), 'MyBookingsView');
const MyFavoritesView = lazyNamed(
  () => import('./components/marketplace/MyFavoritesView'),
  'MyFavoritesView',
);
const PricingView = lazyNamed(() => import('./components/marketplace/PricingView'), 'PricingView');
const ShopView = lazyNamed(() => import('./components/erp/ShopView'), 'ShopView');
const AppProvider = lazyNamed(() => import('./context/AppContext'), 'AppProvider');
const ErpLayout = lazyNamed(() => import('./components/erp/ErpLayout'), 'ErpLayout');
const OnboardingGate = lazyNamed(() => import('./components/auth/OnboardingGate'), 'OnboardingGate');
const AdminDashboard = lazyNamed(() => import('./components/admin/AdminDashboard'), 'AdminDashboard');
const LoginPage = lazyNamed(() => import('./components/auth/LoginPage'), 'LoginPage');
const SignupPage = lazyNamed(() => import('./components/auth/SignupPage'), 'SignupPage');
const VerifyEmailPage = lazyNamed(() => import('./components/auth/VerifyEmailPage'), 'VerifyEmailPage');
const ForgotPasswordPage = lazyNamed(
  () => import('./components/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = lazyNamed(() => import('./components/auth/ResetPasswordPage'), 'ResetPasswordPage');

const withSuspense = (element: React.ReactNode, label?: string) => (
  <Suspense fallback={<RouteLoadingFallback label={label} />}>{element}</Suspense>
);

// Les routes n'utilisent ni loaders ni actions React Router : le routeur déclaratif
// évite d'inclure le moteur de données dans le chargement initial.
const routes = [
  // L'ERP vit hors du shell marketplace : son propre garde d'accès s'applique
  // AVANT tout rendu métier (session, e-mail vérifié, membership actif).
  {
    path: '/app/*',
    element: withSuspense(
      <OnboardingGate>
        <AppProvider>
          <ErpLayout />
          {/* Les toasts de l'ERP vivent hors du shell marketplace. */}
          <ToastContainer />
        </AppProvider>
      </OnboardingGate>,
      'Chargement de votre espace professionnel…',
    ),
  },
  {
    path: '/',
    element: (
      <SalonProvider>
        <App />
      </SalonProvider>
    ),
    children: [
      {
        index: true,
        element: <MarketplaceHome />,
      },
      {
        path: 'salons/:slug',
        element: withSuspense(<SalonPublicPage />, 'Chargement de la vitrine du salon…'),
      },
      {
        // Portail client persistant : le jeton secret voyage par fragment (#)
        // ou état mémoire pour ne pas être journalisé dans les URL HTTP.
        path: 'reservation',
        element: withSuspense(<BookingPortalView />, 'Chargement de votre réservation…'),
      },
      {
        // Compatibilité ascendante avec d'anciens e-mails (/reservation/:token),
        // immédiatement nettoyée côté navigateur vers /reservation.
        path: 'reservation/:token',
        element: withSuspense(<BookingPortalView />, 'Chargement de votre réservation…'),
      },
      {
        path: 'mes-reservations',
        element: withSuspense(<MyBookingsView />, 'Chargement de vos réservations…'),
      },
      {
        path: 'mes-favoris',
        element: withSuspense(<MyFavoritesView />, 'Chargement de vos favoris…'),
      },
      {
        path: 'connexion',
        element: withSuspense(<LoginPage />, 'Chargement de la connexion…'),
      },
      {
        path: 'inscription',
        element: withSuspense(<SignupPage />, 'Chargement de l’inscription…'),
      },
      {
        path: 'register',
        element: withSuspense(<SignupPage />, 'Chargement de l’inscription…'),
      },
      {
        path: 'verifier-email',
        element: withSuspense(<VerifyEmailPage />, 'Vérification en cours…'),
      },
      {
        path: 'mot-de-passe-oublie',
        element: withSuspense(<ForgotPasswordPage />),
      },
      {
        path: 'reinitialiser',
        element: withSuspense(<ResetPasswordPage />),
      },
      {
        path: 'vitrine',
        element: withSuspense(
          <AppProvider>
            <ShopView />
            <ToastContainer />
          </AppProvider>,
        ),
      },
      {
        path: 'tarifs',
        element: withSuspense(<PricingView />, 'Chargement des tarifs…'),
      },
      {
        path: 'pricing',
        element: withSuspense(<PricingView />, 'Chargement des tarifs…'),
      },
      {
        path: 'admin',
        element: withSuspense(<AdminDashboard />, 'Chargement de la console SuperAdmin…'),
      },
      {
        path: 'admin/console',
        element: withSuspense(<AdminDashboard />, 'Chargement de la console SuperAdmin…'),
      },
      {
        path: 'admin/dashboard',
        element: withSuspense(<AdminDashboard />, 'Chargement de la console SuperAdmin…'),
      },
      {
        path: 'admin/login',
        element: withSuspense(<AdminDashboard />, 'Chargement de la console SuperAdmin…'),
      },
    ],
  },
];

function AppRoutes() {
  return useRoutes(routes);
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
