import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';

const languages = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
];

const LanguageSelector = ({ variant = 'dark' }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  // Styles based on variant (dark = sidebar, light = mobile header)
  const buttonStyles = variant === 'light' 
    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
    : 'bg-zinc-800 hover:bg-zinc-700 text-white';
  
  const dropdownStyles = variant === 'light'
    ? 'bg-white border-zinc-200 shadow-lg'
    : 'bg-zinc-800 border-zinc-700 shadow-xl';
  
  const itemStyles = variant === 'light'
    ? 'hover:bg-zinc-100 text-zinc-700'
    : 'hover:bg-zinc-700 text-zinc-300';
  
  const activeItemStyles = variant === 'light'
    ? 'bg-red-50 text-red-700'
    : 'bg-zinc-700 text-white';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${buttonStyles}`}
        data-testid="language-selector"
      >
        <Globe className="w-4 h-4" />
        <span className="text-lg">{currentLang.flag}</span>
        <span>{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className={`absolute ${variant === 'light' ? 'right-0' : 'left-0'} top-full mt-2 z-50`}>
          <div className={`rounded-lg overflow-hidden min-w-[160px] border ${dropdownStyles}`}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left transition-colors ${
                  i18n.language === lang.code ? activeItemStyles : itemStyles
                }`}
                data-testid={`lang-${lang.code}`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
