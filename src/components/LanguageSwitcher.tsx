import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../lib/i18n';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  return (
    <div className={`btn-group btn-group-sm ${className}`} role="group" aria-label="Language">
      <button
        type="button"
        className={`btn ${i18n.language === 'vi' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => changeLanguage('vi')}
      >
        VI
      </button>
      <button
        type="button"
        className={`btn ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => changeLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
