import 'i18next';
import type en from './locales/en.json';

// Typed translation keys: t('players.heading') autocompletes, typos fail tsc.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
