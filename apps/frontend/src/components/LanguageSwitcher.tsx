import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage;

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className="flex rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur"
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => void i18n.changeLanguage(lng)}
          aria-pressed={current === lng}
          title={t(`language.${lng}`)}
          className={`rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wider transition ${
            current === lng
              ? 'bg-star text-night-950 shadow-[0_0_12px] shadow-star/60'
              : 'text-silver/80 hover:text-white'
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
