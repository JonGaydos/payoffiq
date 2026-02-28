import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ComingSoonPage from './pages/ComingSoonPage';

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

        {/* Future phase placeholders */}
        <Route path="strategy" element={<ComingSoonPage title="Debt Strategy" phase={4} />} />
        <Route path="bills" element={<ComingSoonPage title="Utilities & Bills" phase={5} />} />
        <Route path="insurance" element={<ComingSoonPage title="Insurance" phase={6} />} />
        <Route path="documents" element={<ComingSoonPage title="Documents" phase={7} />} />
        <Route path="maintenance" element={<ComingSoonPage title="Maintenance" phase={8} />} />
        <Route path="calendar" element={<ComingSoonPage title="Calendar" phase={9} />} />
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
