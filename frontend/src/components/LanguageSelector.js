import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
];

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
  };

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-white text-sm"
        data-testid="language-selector"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.name}</span>
      </button>
      
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
        <div className="bg-zinc-800 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-zinc-700 transition-colors ${
                i18n.language === lang.code ? 'bg-zinc-700 text-white' : 'text-zinc-300'
              }`}
              data-testid={`lang-${lang.code}`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
