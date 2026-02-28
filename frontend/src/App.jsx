import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';


// Loan pages
import LoansManagerPage from './pages/loans/LoansManagerPage';
import LoanDashboardPage, { LoanOverview } from './pages/loans/LoanDashboardPage';
import PaymentsPage from './pages/loans/PaymentsPage';
import CalculatorPage from './pages/loans/CalculatorPage';
import EscrowPage from './pages/loans/EscrowPage';
import ArmRatesPage from './pages/loans/ArmRatesPage';

// Credit card pages
import CreditCardsPage from './pages/credit-cards/CreditCardsPage';
import CardDetailPage from './pages/credit-cards/CardDetailPage';

// Strategy pages
import StrategyPage from './pages/strategy/StrategyPage';
import WhatIfPage from './pages/strategy/WhatIfPage';

// Bill pages
import BillsPage from './pages/bills/BillsPage';
import BillDetailPage from './pages/bills/BillDetailPage';
import AddBillPage from './pages/bills/AddBillPage';

// Insurance pages
import InsurancePage from './pages/insurance/InsurancePage';

// Document pages
import DocumentsPage from './pages/documents/DocumentsPage';

// Maintenance pages
import MaintenancePage from './pages/maintenance/MaintenancePage';

// Calendar
import CalendarPage from './pages/CalendarPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-warm-gray font-serif text-lg">Loading...</div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AuthRoute() {
  const { isAuthenticated, isLoading, needsSetup } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-warm-gray font-serif text-lg">Loading...</div>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <LoginPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Loan routes */}
        <Route path="loans" element={<LoansManagerPage />} />
        <Route path="loans/:loanId" element={<LoanDashboardPage />}>
          <Route index element={<LoanOverview />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="escrow" element={<EscrowPage />} />
          <Route path="arm-rates" element={<ArmRatesPage />} />
        </Route>

        {/* Credit card routes */}
        <Route path="credit-cards" element={<CreditCardsPage />} />
        <Route path="credit-cards/:cardId" element={<CardDetailPage />} />

        {/* Strategy routes */}
        <Route path="strategy" element={<StrategyPage />} />
        <Route path="strategy/what-if" element={<WhatIfPage />} />

        {/* Bill routes */}
        <Route path="bills" element={<BillsPage />} />
        <Route path="bills/add" element={<AddBillPage />} />
        <Route path="bills/:categoryId" element={<BillDetailPage />} />

        {/* Insurance routes */}
        <Route path="insurance" element={<InsurancePage />} />

        {/* Document routes */}
        <Route path="documents" element={<DocumentsPage />} />

        {/* Maintenance routes */}
        <Route path="maintenance" element={<MaintenancePage />} />

        {/* Calendar */}
        <Route path="calendar" element={<CalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <AppRoutes />
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
