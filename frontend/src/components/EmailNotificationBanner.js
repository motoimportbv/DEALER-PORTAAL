import React, { useState, useEffect } from 'react';
import { Mail, Check, X } from 'lucide-react';

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
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 relative" data-testid="email-notification-banner">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-green-600 hover:text-green-800 p-1"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="bg-green-100 p-2 rounded-full">
          <Mail className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-green-800">Email Meldingen Actief</h3>
            <Check className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-sm text-green-700">
            U ontvangt automatisch een email op <strong>{userEmail}</strong> wanneer er nieuwe motoren worden toegevoegd.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailNotificationBanner;
