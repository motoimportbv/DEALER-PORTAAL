import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TermsModal = ({ isOpen, onAccept, token }) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!agreed) {
      toast.error('U moet akkoord gaan met de voorwaarden');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/accept-terms`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Voorwaarden geaccepteerd');
      onAccept();
    } catch (error) {
      console.error('Error accepting terms:', error);
      toast.error('Kon voorwaarden niet accepteren');
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
            Algemene Voorwaarden
          </h2>
          <p className="text-zinc-400 mt-1">Moto Import B.V.</p>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-zinc-900">Artikel 1 - Definities</h3>
            <p className="text-zinc-600 mb-4">
              In deze voorwaarden wordt verstaan onder:
            </p>
            <ul className="text-zinc-600 mb-4 list-disc pl-5 space-y-1">
              <li><strong>Moto Import:</strong> Moto Import B.V., gevestigd te Schalkhaar</li>
              <li><strong>Dealer:</strong> De professionele wederverkoper die motorfietsen afneemt van Moto Import</li>
              <li><strong>Platform:</strong> De online omgeving waarop motorfietsen worden aangeboden</li>
              <li><strong>Bestelling:</strong> Een order geplaatst door de Dealer via het Platform</li>
            </ul>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 2 - Toepasselijkheid</h3>
            <p className="text-zinc-600 mb-4">
              Deze algemene voorwaarden zijn van toepassing op alle aanbiedingen, bestellingen en overeenkomsten 
              tussen Moto Import en de Dealer. Door gebruik te maken van het Platform gaat de Dealer akkoord 
              met deze voorwaarden.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 3 - Bestellingen</h3>
            <p className="text-zinc-600 mb-4">
              3.1. Alle bestellingen via het Platform zijn bindend zodra deze door de Dealer zijn bevestigd.<br/>
              3.2. Moto Import behoudt zich het recht voor bestellingen te weigeren zonder opgaaf van reden.<br/>
              3.3. Prijzen zijn exclusief BTW en eventuele bezorgkosten, tenzij anders vermeld.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 4 - Levering</h3>
            <p className="text-zinc-600 mb-4">
              4.1. Levering geschiedt op het door de Dealer opgegeven adres of op locatie van Moto Import.<br/>
              4.2. Bezorgkosten worden apart berekend en vooraf gecommuniceerd.<br/>
              4.3. Risico gaat over op de Dealer bij aflevering van de motorfiets.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 5 - Betaling</h3>
            <p className="text-zinc-600 mb-4">
              5.1. Betaling dient te geschieden binnen 14 dagen na factuurdatum, tenzij anders overeengekomen.<br/>
              5.2. Bij niet-tijdige betaling is de Dealer van rechtswege in verzuim.<br/>
              5.3. Moto Import behoudt zich het recht voor om vooruitbetaling te verlangen.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 6 - Garantie</h3>
            <p className="text-zinc-600 mb-4">
              6.1. Op alle motorfietsen geldt de door de fabrikant verstrekte garantie.<br/>
              6.2. Garantieclaims dienen schriftelijk te worden ingediend bij Moto Import.<br/>
              6.3. Garantie vervalt bij onjuist gebruik of modificaties door de Dealer.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 7 - Aansprakelijkheid</h3>
            <p className="text-zinc-600 mb-4">
              7.1. De aansprakelijkheid van Moto Import is beperkt tot het factuurbedrag van de betreffende bestelling.<br/>
              7.2. Moto Import is niet aansprakelijk voor indirecte schade of gevolgschade.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 8 - Privacy</h3>
            <p className="text-zinc-600 mb-4">
              8.1. Moto Import verwerkt persoonsgegevens conform de AVG.<br/>
              8.2. Gegevens worden uitsluitend gebruikt voor de uitvoering van de overeenkomst en communicatie.<br/>
              8.3. Gegevens worden niet aan derden verstrekt zonder toestemming van de Dealer.
            </p>

            <h3 className="text-lg font-semibold text-zinc-900 mt-6">Artikel 9 - Slotbepalingen</h3>
            <p className="text-zinc-600 mb-4">
              9.1. Op alle overeenkomsten is Nederlands recht van toepassing.<br/>
              9.2. Geschillen worden voorgelegd aan de bevoegde rechter te Zwolle.<br/>
              9.3. Moto Import behoudt zich het recht voor deze voorwaarden te wijzigen.
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
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
            />
            <label htmlFor="terms-checkbox" className="text-sm text-zinc-700 cursor-pointer">
              Ik heb de algemene voorwaarden gelezen en ga hiermee akkoord. 
              Ik begrijp dat deze voorwaarden van toepassing zijn op alle bestellingen die ik plaats via het Moto Import platform.
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
              'Accepteren en Doorgaan'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
