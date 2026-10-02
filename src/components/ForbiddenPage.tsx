import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <FiShield size={64} style={{ color: 'var(--color-danger)', marginBottom: 16 }} />
      <h1 style={{ fontSize: 72, fontWeight: 800, color: 'var(--color-muted)', lineHeight: 1 }}>{t('forbidden.code')}</h1>
      <h2 className="mt-2 mb-3">{t('forbidden.title')}</h2>
      <p className="text-muted mb-4">{t('forbidden.message')}</p>
      <Link to="/dashboard" className="btn btn-outline-primary">{t('common.backHome')}</Link>
    </div>
  );
}
