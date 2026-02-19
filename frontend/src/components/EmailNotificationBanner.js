import React, { useState, useEffect } from 'react';
import { Mail, Check, X, Phone } from 'lucide-react';

const EmailNotificationBanner = ({ userEmail }) => {
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    // Check if user has dismissed the banner before
    const isDismissed = localStorage.getItem('emailNotificationBannerDismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('emailNotificationBannerDismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 mb-6 relative" data-testid="email-notification-banner">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="space-y-3 pr-6">
        {/* Email notificatie */}
        <div className="flex items-start gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <Mail className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-green-800">Email Meldingen Actief</h3>
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm text-green-700">
              U ontvangt automatisch een email op <strong>{userEmail}</strong> bij nieuwe motoren.
            </p>
          </div>
        </div>

        {/* SMS notificatie */}
        <div className="flex items-start gap-3 pt-2 border-t border-green-200">
          <div className="bg-blue-100 p-2 rounded-full">
            <Phone className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-blue-800">SMS Meldingen</h3>
              <Check className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-sm text-blue-700">
              U kunt ook SMS meldingen ontvangen over nieuwe motoren.
            </p>
            <div className="mt-2 bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-medium text-gray-800">📱 Sla dit nummer op in uw contacten:</p>
              <p className="text-lg font-bold text-blue-600 mt-1">+1 765-681-4620</p>
              <p className="text-xs text-gray-500 mt-1">Opslaan als "Moto Import"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailNotificationBanner;
