import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Smartphone, Battery, Bell, CheckCircle, Settings } from 'lucide-react';

// Detect device type
const getDeviceType = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }
  
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  return 'other';
};

const BackgroundPermissionModal = ({ isOpen, onClose, onAccept }) => {
  const { t } = useTranslation();
  const [deviceType, setDeviceType] = useState('other');
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    setDeviceType(getDeviceType());
  }, []);

  const handleAccept = () => {
    if (hasAccepted) {
      // Store that user has accepted
      localStorage.setItem('backgroundPermissionAccepted', 'true');
      onAccept();
      onClose();
    }
  };

  const AndroidInstructions = () => (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-2">
          <Smartphone className="w-5 h-5" />
          Android Instellingen
        </h4>
        <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
          <li>Ga naar <strong>Instellingen</strong> op uw telefoon</li>
          <li>Tik op <strong>Apps</strong> of <strong>Applicaties</strong></li>
          <li>Zoek en tik op <strong>Chrome</strong> (of uw browser)</li>
          <li>Tik op <strong>Batterij</strong> of <strong>Accuverbruik</strong></li>
          <li>Selecteer <strong>"Niet beperken"</strong> of <strong>"Geen beperkingen"</strong></li>
        </ol>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
          <Battery className="w-5 h-5" />
          Batterij Optimalisatie Uitschakelen
        </h4>
        <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
          <li>Ga naar <strong>Instellingen → Batterij</strong></li>
          <li>Tik op <strong>Batterijbesparing</strong> of <strong>Batterij optimalisatie</strong></li>
          <li>Zoek <strong>Chrome</strong> in de lijst</li>
          <li>Selecteer <strong>"Niet optimaliseren"</strong></li>
        </ol>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
          <Bell className="w-5 h-5" />
          Belangrijk
        </h4>
        <p className="text-sm text-amber-700">
          Na deze instellingen: <strong>sluit de Moto Import app NIET volledig af</strong>. 
          Laat de app op de achtergrond draaien. Swipe de app niet weg uit uw recente apps.
        </p>
      </div>
    </div>
  );

  const IOSInstructions = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
          <Smartphone className="w-5 h-5" />
          iPhone/iPad Instellingen
        </h4>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>Ga naar <strong>Instellingen</strong> op uw iPhone</li>
          <li>Tik op <strong>Safari</strong> (of de browser die u gebruikt)</li>
          <li>Zorg dat <strong>Achtergrond App Vernieuwen</strong> aan staat</li>
        </ol>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5" />
          Voor geïnstalleerde webapp
        </h4>
        <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
          <li>Ga naar <strong>Instellingen → Algemeen</strong></li>
          <li>Tik op <strong>Achtergrond App Vernieuwen</strong></li>
          <li>Zorg dat dit <strong>Aan</strong> staat</li>
        </ol>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
          <Bell className="w-5 h-5" />
          Belangrijk
        </h4>
        <p className="text-sm text-amber-700">
          Na deze instellingen: <strong>sluit de Moto Import app NIET volledig af</strong>. 
          Laat de app op de achtergrond draaien. Swipe de app niet weg uit uw recente apps.
        </p>
      </div>
    </div>
  );

  const OtherInstructions = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
        <Bell className="w-5 h-5" />
        Belangrijk
      </h4>
      <p className="text-sm text-amber-700">
        Voor de beste ervaring met push meldingen: <strong>sluit de Moto Import app NIET volledig af</strong>. 
        Laat de app op de achtergrond draaien zodat u direct naar de juiste motor wordt geleid wanneer u op een melding klikt.
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            Push Meldingen Instellen
          </DialogTitle>
          <DialogDescription>
            Om push meldingen optimaal te laten werken, moet u enkele instellingen aanpassen op uw telefoon.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {deviceType === 'android' && <AndroidInstructions />}
          {deviceType === 'ios' && <IOSInstructions />}
          {deviceType === 'other' && <OtherInstructions />}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-start space-x-3 mb-4">
            <Checkbox 
              id="acceptBackground" 
              checked={hasAccepted}
              onCheckedChange={setHasAccepted}
              className="mt-1"
            />
            <Label 
              htmlFor="acceptBackground" 
              className="text-sm text-zinc-700 cursor-pointer leading-relaxed"
            >
              Ik heb de instellingen aangepast en begrijp dat ik de app op de achtergrond moet laten draaien voor de beste ervaring met push meldingen.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Later
          </Button>
          <Button 
            onClick={handleAccept}
            disabled={!hasAccepted}
            className="bg-red-600 hover:bg-red-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackgroundPermissionModal;
