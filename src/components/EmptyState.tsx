import { useTranslation } from 'react-i18next';

export default function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return <div className="text-center text-muted py-5">{message ?? t('common.noData')}</div>;
}
