import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import NotFoundPage from './components/NotFoundPage';
import ForbiddenPage from './components/ForbiddenPage';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';

// ✅ Dashboard Rollers
import DashboardPage1 from './features/dashboard/pages/DashboardPage1';

import ProjectsPage from './features/projects/pages/ProjectsPage';
import UsersPage from './features/users/pages/UsersPage';
import FinancePage from './features/finance/pages/FinancePage';

// ✅ Cấu hình Dies (cũ)
import SettingsPage from './features/settings/page/SettingsPage';

// ✅ THÊM MỚI: Cấu hình Rollers (SettingsPage1)
import SettingsPage1 from './features/settings/page/SettingsPage1';

// ✅ Die pages
import WorksPage from './features/works/pages/Dies/WorksPage';
import DiePublicPage from './features/works/pages/Dies/DiePublicPage';

// ✅ Roller pages
import RollerWorksPage from './features/works/pages/Rollers/RollerWorksPage';
import RollerPublicPage from './features/works/pages/Rollers/RollerPublicPage';

import './lib/adapters/nodeAdapter';
import './lib/db';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* ✅ ROUTE PUBLIC — Quét QR mở trang này, KHÔNG cần login */}
              <Route path="/die/:id" element={<DiePublicPage />} />
              <Route path="/roller/:id" element={<RollerPublicPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* ✅ Dashboard Dies */}
                <Route path="dashboard" element={<DashboardPage />} />

                {/* ✅ Dashboard Rollers */}
                <Route path="dashboard-rollers" element={<DashboardPage1 />} />

                <Route path="projects" element={<ProjectsPage />} />

                {/* ✅ Die route */}
                <Route path="works" element={<WorksPage />} />

                {/* ✅ Roller route */}
                <Route path="roller-works" element={<RollerWorksPage />} />

                <Route path="finance" element={<FinancePage />} />

                <Route
                  path="users"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UsersPage />
                    </ProtectedRoute>
                  }
                />

                {/* ✅ Cấu hình Dies */}
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />

                {/* ✅ THÊM MỚI: Cấu hình Rollers */}
                <Route
                  path="settings-rollers"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SettingsPage1 />
                    </ProtectedRoute>
                  }
                />

                <Route path="403" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}