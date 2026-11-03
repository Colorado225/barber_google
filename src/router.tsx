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

const router = createBrowserRouter([
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
        // ErpLayout is a self-contained shell: it renders its own sidebar and
        // panels, and reads the active view from the URL segment.
        path: 'app/*',
        element: <ErpLayout />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
