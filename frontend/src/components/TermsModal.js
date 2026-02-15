import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TermsModal = ({ isOpen, onAccept, token }) => {
  const { t, i18n } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!agreed) {
      toast.error(t('terms.mustAgree'));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/accept-terms`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('terms.accepted'));
      onAccept();
    } catch (error) {
      console.error('Error accepting terms:', error);
      toast.error(t('terms.acceptFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-zinc-900 text-white p-6 rounded-t-xl">
          <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight">
            {t('terms.title')}
          </h2>
          <p className="text-zinc-400 mt-1">Moto Import B.V.</p>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-zinc-900">{t('terms.article1Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article1Intro')}
            </p>
            <ul className="text-zinc-600 mb-4 list-disc pl-5 space-y-1">
              <li><strong>Moto Import:</strong> {t('terms.defMotoImport')}</li>
              <li><strong>{t('nav.dealers')}:</strong> {t('terms.defDealer')}</li>
              <li><strong>{t('terms.platform')}:</strong> {t('terms.defPlatform')}</li>
              <li><strong>{t('terms.order')}:</strong> {t('terms.defOrder')}</li>
            </ul>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article2Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article2Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article3Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article3Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article4Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article4Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article5Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article5Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article6Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article6Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article7Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article7Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article8Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article8Text')}
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">{t('terms.article9Title')}</h3>
            <p className="text-zinc-600 mb-4">
              {t('terms.article9Text')}
            </p>

            <div className="mt-6 p-4 bg-zinc-100 rounded-lg">
              <p className="text-zinc-600 text-sm">
                <strong>Moto Import B.V.</strong><br/>
                Horsterhoekweg 11<br/>
                7433 SV Schalkhaar<br/>
                KvK: [KvK nummer]<br/>
                BTW: [BTW nummer]
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-zinc-200 p-6 bg-zinc-50 rounded-b-xl">
          <div className="flex items-start gap-3 mb-4">
            <Checkbox 
              id="terms-checkbox"
              data-testid="terms-checkbox"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
            />
            <label htmlFor="terms-checkbox" className="text-sm text-zinc-700 cursor-pointer">
              {t('terms.agreeText')}
            </label>
          </div>
          
          <Button 
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="w-full bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide"
            data-testid="accept-terms-btn"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              t('terms.acceptButton')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
