import { useTranslation } from 'react-i18next';

export default function LoadingOverlay({ label }: { label?: string }) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading');
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
      <div className="spinner-border text-primary mb-2" role="status" aria-label={resolvedLabel} />
      <span>{resolvedLabel}</span>
    </div>
  );
}
