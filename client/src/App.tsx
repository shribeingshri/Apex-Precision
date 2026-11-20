import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Clients } from './pages/Clients';
import { Projects } from './pages/Projects';
import { Manufacturing } from './pages/Manufacturing';
import { Quality } from './pages/Quality';
import { Delivery } from './pages/Delivery';
import { Billing } from './pages/Billing';
import { Payments } from './pages/Payments';
import { Expenses } from './pages/Expenses';
import { Payroll } from './pages/Payroll';
import { Retainers } from './pages/Retainers';
import { Employees } from './pages/Employees';
import { Tasks } from './pages/Tasks';
import { Messages } from './pages/Messages';
import { EmailLogs } from './pages/EmailLogs';
import { Activity } from './pages/Activity';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="clients" element={<Clients />} />
            <Route path="projects" element={<Projects />} />
            <Route path="delivery" element={<Delivery />} />
            <Route path="messages" element={<Messages />} />
            <Route path="billing" element={<Billing />} />
            <Route path="payments" element={<Payments />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="retainers" element={<Retainers />} />
            <Route path="manufacturing" element={<Manufacturing />} />
            <Route path="quality" element={<Quality />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="email-logs" element={<EmailLogs />} />
            <Route path="activity" element={<Activity />} />
            <Route path="reports" element={<Reports />} />
            <Route path="employees" element={<Employees />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
