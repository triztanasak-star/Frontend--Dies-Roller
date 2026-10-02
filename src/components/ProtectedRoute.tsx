import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from './LoadingOverlay';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, isLoading, can } = useAuth();
  const { t } = useTranslation();

  if (isLoading) return <LoadingOverlay label={t('common.authenticating')} />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !can('admin')) return <Navigate to="/403" replace />;

  return <>{children}</>;
}
