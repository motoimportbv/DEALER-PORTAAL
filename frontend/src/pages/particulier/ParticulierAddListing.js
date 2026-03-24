import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ArrowLeft, ArrowRight, Bike } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BRANDS = {
  'BMW': ['F 650', 'F 700 GS', 'F 750 GS', 'F 800 GS', 'F 850 GS', 'F 900 R', 'F 900 XR', 'G 310 GS', 'G 310 R', 'K 1200 GT', 'K 1200 RS', 'K 1300 GT', 'K 1300 R', 'K 1300 S', 'K 1600 B', 'K 1600 GT', 'K 1600 GTL', 'M 1000 R', 'M 1000 RR', 'R 1200 GS', 'R 1200 R', 'R 1200 RS', 'R 1200 RT', 'R 1250 GS', 'R 1250 R', 'R 1250 RS', 'R 1250 RT', 'R 18', 'R Nine T', 'S 1000 R', 'S 1000 RR', 'S 1000 XR'],
  'Ducati': ['Diavel', 'Hypermotard', 'Monster', 'Monster 821', 'Monster 1200', 'Multistrada', 'Multistrada 1260', 'Multistrada V4', 'Panigale V2', 'Panigale V4', 'Scrambler', 'Streetfighter V4', 'SuperSport', 'XDiavel'],
  'Honda': ['Africa Twin', 'CB 125', 'CB 300', 'CB 500', 'CB 650 R', 'CB 1000 R', 'CBR 125', 'CBR 250', 'CBR 500 R', 'CBR 600 RR', 'CBR 650 R', 'CBR 1000 RR', 'CRF 250', 'CRF 300', 'CRF 1100', 'Forza', 'GL 1800 Gold Wing', 'MSX 125', 'NC 750', 'NT 1100', 'Rebel 500', 'Rebel 1100', 'X-ADV'],
  'Kawasaki': ['ER-6N', 'Ninja 125', 'Ninja 300', 'Ninja 400', 'Ninja 650', 'Ninja 1000', 'Ninja ZX-6R', 'Ninja ZX-10R', 'Versys 650', 'Versys 1000', 'Vulcan S', 'W800', 'Z400', 'Z650', 'Z900', 'Z900RS', 'Z1000', 'ZZR 1400'],
  'KTM': ['125 Duke', '200 Duke', '250 Duke', '390 Adventure', '390 Duke', '690 Enduro', '690 SMC', '790 Adventure', '790 Duke', '890 Adventure', '890 Duke', '1090 Adventure', '1190 Adventure', '1290 Super Adventure', '1290 Super Duke'],
  'Triumph': ['Bobber', 'Bonneville', 'Bonneville T100', 'Bonneville T120', 'Daytona 675', 'Rocket 3', 'Scrambler 400X', 'Scrambler 900', 'Scrambler 1200', 'Speed Triple', 'Speed Triple 1200', 'Speed Twin', 'Street Triple', 'Street Triple RS', 'TF 250 E', 'TF 250 X', 'TF 450 E', 'TF 450 RC', 'Thruxton RS', 'Tiger 660', 'Tiger 800', 'Tiger 850 Sport', 'Tiger 900', 'Tiger 1200', 'Tiger Sport 660', 'Trident 660'],
  'Yamaha': ['FZ6', 'FZ8', 'MT-03', 'MT-07', 'MT-09', 'MT-10', 'R1', 'R3', 'R6', 'R7', 'Tenere 700', 'Tracer 700', 'Tracer 900', 'Tracer 9 GT', 'XJ6', 'XSR 700', 'XSR 900', 'YZF-R125'],
  'Suzuki': ['Bandit', 'GSX-R 600', 'GSX-R 750', 'GSX-R 1000', 'GSX-S 750', 'GSX-S 1000', 'Hayabusa', 'SV 650', 'V-Strom 650', 'V-Strom 1050'],
  'Harley-Davidson': ['Breakout', 'Fat Bob', 'Fat Boy', 'Heritage Classic', 'Iron 883', 'Low Rider', 'Night Rod', 'Road Glide', 'Road King', 'Softail', 'Sport Glide', 'Sportster S', 'Street Bob', 'Street Glide', 'Ultra Limited'],
  'Aprilia': ['Dorsoduro', 'RS 125', 'RS 660', 'RSV4', 'Shiver', 'Tuareg 660', 'Tuono'],
  'Moto Guzzi': ['Griso', 'Norge', 'Stelvio', 'V7', 'V85 TT', 'V100 Mandello'],
  'Brixton': ['Cromwell 1200', 'Crossfire 500', 'Felsberg 125', 'Felsberg 250', 'Rayburn 125', 'Sunray 125'],
  'Overig': ['Ander merk/model'],
};

export default function ParticulierAddListing() {
  const [form, setForm] = useState({
    brand: '', model: '', year: new Date().getFullYear(), mileage: 0,
    price: 0, description: '', color: '', phone: '', email: '', city: '', name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const models = form.brand ? BRANDS[form.brand] || [] : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.brand || !form.model || !form.price) {
      setError('Vul merk, model en vraagprijs in');
      return;
    }
    setLoading(true);
    try {
      // Step 1: Create listing
      const res = await fetch(`${API}/api/private-listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          name: form.name || user.name,
          email: form.email || user.email,
          phone: form.phone || user.phone || '',
          city: form.city || user.city || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Fout bij aanmaken');
      
      // Step 2: Start Stripe checkout immediately
      const checkoutRes = await fetch(`${API}/api/private-listings/${data.listing_id}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ origin_url: window.location.origin }),
      });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.checkout_url) {
        window.location.href = checkoutData.checkout_url;
        return;
      }
      // Fallback: go to dashboard if checkout fails
      navigate('/particulier');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const set = (key, val) => setForm({ ...form, [key]: val });

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/particulier')} className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Terug
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Motor aanbieden</h1>
            <p className="text-zinc-500 text-xs">Vul de gegevens in van uw motor</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="add-listing-form">
          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Merk *</label>
              <select
                data-testid="listing-brand"
                value={form.brand}
                onChange={(e) => { set('brand', e.target.value); set('model', ''); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              >
                <option value="">Selecteer merk</option>
                {Object.keys(BRANDS).map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Model *</label>
              <select
                data-testid="listing-model"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              >
                <option value="">Selecteer model</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Year, Mileage, Color */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Bouwjaar *</label>
              <input data-testid="listing-year" type="number" value={form.year} onChange={(e) => set('year', parseInt(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Km-stand</label>
              <input data-testid="listing-mileage" type="number" value={form.mileage} onChange={(e) => set('mileage', parseInt(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Kleur</label>
              <input data-testid="listing-color" type="text" value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Zwart"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50" />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Vraagprijs (&euro;) *</label>
            <input data-testid="listing-price" type="number" value={form.price} onChange={(e) => set('price', parseFloat(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Beschrijving</label>
            <textarea data-testid="listing-description" value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={4} placeholder="Beschrijf uw motor (opties, onderhoud, staat...)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 resize-none" />
          </div>

          {/* Contact info */}
          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-bold text-zinc-300 mb-4">Contactgegevens (zichtbaar voor dealers)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Naam</label>
                <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={user.name || ''}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Telefoon</label>
                <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={user.phone || '06-12345678'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={user.email || ''}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Woonplaats</label>
                <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder={user.city || 'Amsterdam'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50" />
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-4 text-sm text-zinc-400">
            Na het aanmaken betaalt u <strong className="text-white">&euro;7,95</strong> via iDEAL of creditcard. 
            Uw motor wordt dan 1 week lang aangeboden aan 100+ dealers in heel Nederland.
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="submit-listing"
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium"
          >
            {loading ? 'Even geduld...' : 'Motor aanbieden'} <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
