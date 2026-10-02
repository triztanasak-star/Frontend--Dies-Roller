import { useTranslation } from 'react-i18next';

export default function ErrorState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return <div className="alert alert-danger" role="alert">{message ?? t('common.error')}</div>;
}
