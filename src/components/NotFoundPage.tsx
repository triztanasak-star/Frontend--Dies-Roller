import { Link } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <FiAlertCircle size={64} style={{ color: 'var(--color-warning)', marginBottom: 16 }} />
      <h1 style={{ fontSize: 72, fontWeight: 800, color: 'var(--color-muted)', lineHeight: 1 }}>{t('notFound.code')}</h1>
      <h2 className="mt-2 mb-3">{t('notFound.title')}</h2>
      <p className="text-muted mb-4">{t('notFound.message')}</p>
      <Link to="/dashboard" className="btn btn-primary">{t('common.backHome')}</Link>
    </div>
  );
}
