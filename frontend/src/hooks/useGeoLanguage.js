import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Map countries to languages
const countryToLanguage = {
  // German speaking
  'DE': 'de', // Germany
  'AT': 'de', // Austria
  'CH': 'de', // Switzerland (German is most common)
  'LI': 'de', // Liechtenstein
  
  // French speaking
  'FR': 'fr', // France
  'BE': 'fr', // Belgium (could be nl or fr, defaulting to fr for foreign suppliers)
  'LU': 'fr', // Luxembourg
  'MC': 'fr', // Monaco
  
  // Italian speaking
  'IT': 'it', // Italy
  'SM': 'it', // San Marino
  'VA': 'it', // Vatican
  
  // Dutch speaking - default
  'NL': 'nl', // Netherlands
};

export const useGeoLanguage = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Only detect if user hasn't manually set a language preference
    const savedLanguage = localStorage.getItem('i18nextLng');
    const hasManuallySelected = localStorage.getItem('languageManuallySelected');
    
    if (hasManuallySelected) {
      // User has manually selected a language, don't override
      return;
    }

    const detectCountry = async () => {
      try {
        // Use free IP geolocation API
        const response = await fetch('https://ipapi.co/json/', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('GeoIP request failed');
        }
        
        const data = await response.json();
        const countryCode = data.country_code;
        
        console.log(`[GeoIP] Detected country: ${countryCode} (${data.country_name})`);
        
        // Log visitor info (useful for analytics)
        console.log(`[GeoIP] Visitor from: ${data.city}, ${data.region}, ${data.country_name}`);
        
        // Map country to language
        const detectedLanguage = countryToLanguage[countryCode] || 'nl';
        
        // Only change if different from current
        if (detectedLanguage !== i18n.language && !savedLanguage) {
          console.log(`[GeoIP] Setting language to: ${detectedLanguage}`);
          i18n.changeLanguage(detectedLanguage);
          
          // Store that this was auto-detected (not manually selected)
          localStorage.setItem('languageAutoDetected', 'true');
          localStorage.setItem('detectedCountry', countryCode);
        }
        
        // Store visitor country for admin analytics
        sessionStorage.setItem('visitorCountry', countryCode);
        sessionStorage.setItem('visitorCity', data.city || 'Unknown');
        sessionStorage.setItem('visitorRegion', data.region || 'Unknown');
        
      } catch (error) {
        console.log('[GeoIP] Could not detect location:', error.message);
        // Fallback to Dutch
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(detectCountry, 500);
    
    return () => clearTimeout(timer);
  }, [i18n]);
};

// Helper function to mark language as manually selected
export const setLanguageManually = (language) => {
  localStorage.setItem('languageManuallySelected', 'true');
  localStorage.setItem('i18nextLng', language);
};

export default useGeoLanguage;
