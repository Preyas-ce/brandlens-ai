import React from 'react';
import { Languages } from 'lucide-react';
import { SupportedLanguage, useLanguage } from '@/contexts/LanguageProvider';

const OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 border border-stone-300 bg-ivory px-2 py-1.5 text-obsidian shadow-sm">
      <Languages className="h-4 w-4 shrink-0 text-copper" aria-hidden="true" />
      <label htmlFor="brandlens-language" className="sr-only">{t('chooseLanguage')}</label>
      <select
        id="brandlens-language"
        aria-label={t('chooseLanguage')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
        className="max-w-[8.4rem] cursor-pointer bg-transparent text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};
