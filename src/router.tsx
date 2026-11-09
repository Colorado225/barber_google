import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SalonPublicPage } from './components/marketplace/salon/SalonPublicPage';
import { BookingPortalView } from './components/marketplace/BookingPortalView';
import { MyBookingsView } from './components/marketplace/MyBookingsView';
import { ErpLayout } from './components/erp/ErpLayout';
import { SalonProvider } from './context/SalonContext';
import { DashboardView } from './components/erp/DashboardView';
import { TodayView } from './components/erp/TodayView';
import { PlanningView } from './components/erp/PlanningView';
import { ClientsView } from './components/erp/ClientsView';
import { ServicesView } from './components/erp/ServicesView';
import { StaffView } from './components/erp/StaffView';
import { CashRegisterView } from './components/erp/CashRegisterView';
import { InventoryView } from './components/erp/InventoryView';
import { ReportsView } from './components/erp/ReportsView';
import { LoyaltyView } from './components/erp/LoyaltyView';
import { ShopView } from './components/erp/ShopView';
import { SalonQrCodeView } from './components/erp/SalonQrCodeView';
import { PricingView } from './components/marketplace/PricingView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { VerifyEmailPage } from './components/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { OnboardingGate } from './components/auth/OnboardingGate';
import { AppProvider } from './context/AppContext';
import { ToastContainer } from './components/common/ToastContainer';

const router = createBrowserRouter([
  // L'ERP vit hors du shell marketplace : son propre garde d'accès s'applique
  // AVANT tout rendu métier (session, e-mail vérifié, membership actif).
  {
    path: '/app/*',
    element: (
      <OnboardingGate>
        <AppProvider>
          <ErpLayout />
          {/* Les toasts de l'ERP vivent hors du shell marketplace. */}
          <ToastContainer />
        </AppProvider>
      </OnboardingGate>
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
        element: <SalonPublicPage />,
      },
      {
        // Portail client persistant : le jeton secret de la réservation suffit,
        // aucun compte n'est nécessaire pour suivre, annuler ou noter.
        path: 'reservation/:token',
        element: <BookingPortalView />,
      },
      {
        path: 'mes-reservations',
        element: <MyBookingsView />,
      },
      {
        path: 'connexion',
        element: <LoginPage />,
      },
      {
        path: 'inscription',
        element: <SignupPage />,
      },
      {
        path: 'register',
        element: <SignupPage />,
      },
      {
        path: 'verifier-email',
        element: <VerifyEmailPage />,
      },
      {
        path: 'mot-de-passe-oublie',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reinitialiser',
        element: <ResetPasswordPage />,
      },
      {
        path: 'vitrine',
        element: <ShopView />,
      },
      {
        path: 'tarifs',
        element: <PricingView />,
      },
      {
        path: 'pricing',
        element: <PricingView />,
      },
      {
        path: 'admin',
        element: <AdminDashboard />,
      },
      {
        path: 'admin/console',
        element: <AdminDashboard />,
      },
      {
        path: 'admin/dashboard',
        element: <AdminDashboard />,
      },
      {
        path: 'admin/login',
        element: <AdminDashboard />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
