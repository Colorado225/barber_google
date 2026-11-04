import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
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
import { ExpensesView } from './components/erp/ExpensesView';
import { ReportsView } from './components/erp/ReportsView';
import { LoyaltyView } from './components/erp/LoyaltyView';
import { ShopView } from './components/erp/ShopView';
import { SalonQrCodeView } from './components/erp/SalonQrCodeView';
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
        // Public salon page reached by QR code: the home opens the salon's
        // booking profile from the `:slug` segment, then canonicalises the URL.
        path: 'salons/:slug',
        element: <MarketplaceHome />,
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
        ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
