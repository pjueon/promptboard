import { createI18n } from 'vue-i18n';
import en from './locales/en';
import ko from './locales/ko';
import ja from './locales/ja';

export type Locale = 'en' | 'ko' | 'ja';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    ko,
    ja,
  },
});

export default i18n;
