import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { FileText, Sparkles, ArrowRight } from 'lucide-react';

const STORAGE_PREFIX = 'coc_announcement_seen_';
// Bump version to re-trigger announcement if needed
const ANNOUNCEMENT_VERSION = 'v1';

const CocAnnouncementPopup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Only dealers (Dutch dealers, not admin/foreign/pakbon)
    if (!user || user.role !== 'dealer' || user.is_foreign_dealer) return;
    const key = `${STORAGE_PREFIX}${user.id}_${ANNOUNCEMENT_VERSION}`;
    if (localStorage.getItem(key)) return;

    // Show after a short delay so the dashboard renders first
    const t = setTimeout(() => setShowPopup(true), 1500);
    return () => clearTimeout(t);
  }, [user]);

  const dismiss = () => {
    if (user?.id) {
      localStorage.setItem(`${STORAGE_PREFIX}${user.id}_${ANNOUNCEMENT_VERSION}`, new Date().toISOString());
    }
    setShowPopup(false);
  };

  const goToMotorcycles = () => {
    dismiss();
    navigate('/dealer');
  };

  if (!showPopup) return null;

  return (
    <Dialog open={showPopup} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md" data-testid="coc-announcement-popup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span>Nieuw: COC / CVO bestellen!</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-zinc-700 leading-relaxed text-sm space-y-2">
                <p className="font-semibold text-purple-900">
                  Nóg sneller een kenteken van het RDW? Dat kan vanaf nu!
                </p>
                <p>
                  Bij het plaatsen van een bestelling kun je eenvoudig een <strong>COC/CVO-document</strong> meebestellen.
                  Wij regelen het voor je bij de fabrikant, zodat jij het kentekenbewijs véél sneller in handen hebt.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-zinc-900 mb-2">Beschikbare merken:</p>
            <div className="grid grid-cols-2 gap-y-1 text-zinc-700">
              <div>• Yamaha — <strong>€75</strong></div>
              <div>• Kawasaki — <strong>€75</strong></div>
              <div>• KTM — <strong>€75</strong></div>
              <div>• Triumph — <strong>€120</strong></div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Honda: bestel je zelf direct bij Honda (link zie je in het bestelscherm).
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={dismiss}
              data-testid="coc-announcement-dismiss"
            >
              Begrepen
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 gap-1"
              onClick={goToMotorcycles}
              data-testid="coc-announcement-cta"
            >
              Bekijk aanbod
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CocAnnouncementPopup;
