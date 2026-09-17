import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import { RouteLoading } from '@/layouts/route-loading';

const AppShell = lazy(() =>
  import('@/layouts/app-shell').then((module) => ({ default: module.AppShell })),
);
const PaymentRoutes = lazy(() =>
  import('@/features/transfers/payment-routes').then((module) => ({
    default: module.PaymentRoutes,
  })),
);
const HomePage = lazy(() =>
  import('@/pages/home-page').then((module) => ({ default: module.HomePage })),
);
const AccountsPage = lazy(() =>
  import('@/pages/accounts-page').then((module) => ({ default: module.AccountsPage })),
);
const AccountDetailPage = lazy(() =>
  import('@/pages/account-detail-page').then((module) => ({ default: module.AccountDetailPage })),
);
const TransactionsPage = lazy(() =>
  import('@/pages/transactions-page').then((module) => ({ default: module.TransactionsPage })),
);
const TransactionDetailPage = lazy(() =>
  import('@/pages/transaction-detail-page').then((module) => ({
    default: module.TransactionDetailPage,
  })),
);
const DiagnosticsPage = lazy(() =>
  import('@/features/diagnostics/diagnostics-page').then((module) => ({
    default: module.DiagnosticsPage,
  })),
);
const LoginPage = lazy(() =>
  import('@/pages/login-page').then((module) => ({ default: module.LoginPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const DesignSystemPage = lazy(() =>
  import('@/pages/design-system-page').then((module) => ({ default: module.DesignSystemPage })),
);
const CardsPage = lazy(() =>
  import('@/features/cards/cards-page').then((module) => ({ default: module.CardsPage })),
);
const CardPaymentDetails = lazy(() =>
  import('@/features/cards/card-payment-details').then((module) => ({
    default: module.CardPaymentDetails,
  })),
);
const CardSimulator = lazy(() =>
  import('@/features/cards/card-simulator').then((module) => ({ default: module.CardSimulator })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/insights/analytics-page').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const BudgetsPage = lazy(() =>
  import('@/features/insights/budgets-page').then((module) => ({ default: module.BudgetsPage })),
);
const SubscriptionsPage = lazy(() =>
  import('@/features/insights/subscriptions-page').then((module) => ({
    default: module.SubscriptionsPage,
  })),
);
export function App() {
  return (
    <Suspense
      fallback={
        <main className="app-main">
          <RouteLoading />
        </main>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/transactions/:id" element={<TransactionDetailPage />} />
          <Route path="/payments/*" element={<PaymentRoutes />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardsPage />} />
          <Route path="/cards/payments/:id" element={<CardPaymentDetails />} />
          <Route path="/demo/card-payments" element={<CardSimulator />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/subscriptions/:id" element={<SubscriptionsPage />} />
          <Route path="/analytics/categories/:category" element={<AnalyticsPage />} />
          <Route path="/analytics/merchants/:merchantId" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route
            path="*"
            element={
              <>
                <h1>Page not found</h1>
                <div className="gallery-section">
                  <p>The address may be incomplete. Your workspace is still here.</p>
                </div>
                <Link className="button button--secondary" to="/home">
                  Return to overview
                </Link>
              </>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
