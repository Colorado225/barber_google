import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { ErpLayoutNew } from './components/erp/ErpLayoutNew';
import { SalonProvider } from './context/SalonContext';
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
        path: 'app',
        element: <ErpLayoutNew />,
        children: [
          {
            index: true,
            element: <TodayView />,
          },
          {
            path: 'aujourdhui',
            element: <TodayView />,
          },
          {
            path: 'planning',
            element: <PlanningView />,
          },
          {
            path: 'clients',
            element: <ClientsView />,
          },
          {
            path: 'prestations',
            element: <ServicesView />,
          },
          {
            path: 'equipe',
            element: <StaffView />,
          },
          {
            path: 'caisse',
            element: <CashRegisterView />,
          },
          {
            path: 'stocks',
            element: <InventoryView />,
          },
          {
            path: 'depenses',
            element: <ExpensesView />,
          },
          {
            path: 'rapports',
            element: <ReportsView />,
          },
          {
            path: 'fidelite',
            element: <LoyaltyView />,
          },
          {
            path: 'vitrine',
            element: <ShopView />,
          },
          {
            path: 'qr-code',
            element: <SalonQrCodeView />,
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
