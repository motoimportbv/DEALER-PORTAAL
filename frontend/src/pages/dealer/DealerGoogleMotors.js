import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Globe, Upload, CreditCard, Check, X, Clock, Eye, Trash2,
  ChevronDown, ChevronUp, Bike, Image as ImageIcon, Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

const BRANDS = [
  'BMW', 'Ducati', 'Honda', 'Kawasaki', 'Yamaha', 'Suzuki', 'KTM', 'Triumph',
  'Harley-Davidson', 'Indian', 'Aprilia', 'Moto Guzzi', 'MV Agusta', 'Husqvarna',
  'Royal Enfield', 'Benelli', 'CF Moto', 'Brixton', 'Fantic', 'SWM', 'Andere'
];

export default function DealerGoogleMotors() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [motors, setMotors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [form, setForm] = useState({
    brand: '', model: '', year: new Date().getFullYear(), price: '',
    mileage: '', description: '', color: '', condition: '', images: []
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [subRes, motorsRes] = await Promise.all([
        axios.get(`${API}/google-motors/subscription`, { headers }),
        axios.get(`${API}/google-motors/my`, { headers }),
      ]);
      setSubscription(subRes.data);
      setMotors(motorsRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle payment return
  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (payment === 'success' && sessionId) {
      const checkPayment = async () => {
        try {
          const res = await axios.get(`${API}/google-motors/check-payment/${sessionId}`, { headers });
          if (res.data.status === 'active') {
            toast.success('Betaling geslaagd! U kunt nu motoren uploaden.');
            fetchData();
          }
        } catch (e) {
          toast.error('Kon betaling niet verifi\u00EBren');
        }
      };
      checkPayment();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (payment === 'cancelled') {
      toast.error('Betaling geannuleerd');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const handleCheckout = async (plan) => {
    try {
      const res = await axios.post(`${API}/google-motors/checkout`, {
        plan,
        origin_url: window.location.origin,
      }, { headers });
      window.location.href = res.data.checkout_url;
    } catch (e) {
      toast.error('Kon betaling niet starten');
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploadingImages(true);
    const newImages = [...form.images];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${API}/upload`, formData, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        });
        newImages.push(res.data.url);
      } catch (e) {
        toast.error(`Upload mislukt: ${file.name}`);
      }
    }
    setForm(f => ({ ...f, images: newImages }));
    setUploadingImages(false);
  };

  const removeImage = (idx) => {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.brand || !form.model || !form.price) {
      toast.error('Vul merk, model en prijs in');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/google-motors`, {
        ...form,
        year: parseInt(form.year),
        price: parseFloat(form.price),
        mileage: parseInt(form.mileage) || 0,
      }, { headers });
      toast.success('Motor aangemeld! Wacht op goedkeuring van admin.');
      setForm({ brand: '', model: '', year: new Date().getFullYear(), price: '', mileage: '', description: '', color: '', condition: '', images: [] });
      setShowForm(false);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Kon motor niet aanmelden');
    }
    setSubmitting(false);
  };

  const handleDelete = async (motorId) => {
    if (!window.confirm('Weet u zeker dat u deze motor wilt verwijderen?')) return;
    try {
      await axios.delete(`${API}/google-motors/${motorId}`, { headers });
      toast.success('Motor verwijderd');
      fetchData();
    } catch (e) {
      toast.error('Kon motor niet verwijderen');
    }
  };

  const canUpload = subscription?.has_monthly || subscription?.per_motor_credits > 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="dealer-google-motors">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Globe className="w-7 h-7 text-red-600" />
              Google Motoren
            </h1>
            <p className="text-zinc-500 mt-1">Zet uw motoren op Google en bereik miljoenen kopers</p>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6" data-testid="subscription-status">
          <h2 className="text-lg font-bold mb-4">Uw Abonnement</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase font-bold">Maandelijks</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {subscription?.has_monthly ? (
                  <span className="text-green-600">Actief</span>
                ) : (
                  <span className="text-zinc-400">Inactief</span>
                )}
              </p>
              {subscription?.monthly_expires && (
                <p className="text-xs text-zinc-400 mt-1">
                  Verloopt: {new Date(subscription.monthly_expires).toLocaleDateString('nl-NL')}
                </p>
              )}
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase font-bold">Per Motor Credits</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {subscription?.per_motor_credits || 0}
              </p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase font-bold">Actieve Motoren</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {subscription?.active_motors || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border-2 border-zinc-200 hover:border-red-300 transition-colors p-6" data-testid="plan-per-motor">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Bike className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Per Motor</h3>
                <p className="text-xs text-zinc-500">1 motor, 1 week op Google</p>
              </div>
            </div>
            <p className="text-3xl font-black text-red-600 my-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              &euro;2,95 <span className="text-sm font-normal text-zinc-400">/ motor / week</span>
            </p>
            <ul className="text-sm text-zinc-600 space-y-2 mb-5">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />1 motor op Google plaatsen</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />7 dagen zichtbaar</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Uw contactgegevens zichtbaar</li>
            </ul>
            <Button onClick={() => handleCheckout('per_motor')} className="w-full bg-red-600 hover:bg-red-700 text-white" data-testid="buy-per-motor-btn">
              <CreditCard className="w-4 h-4 mr-2" /> Koop 1 Credit
            </Button>
          </div>

          <div className="bg-white rounded-2xl border-2 border-red-500 p-6 relative overflow-hidden" data-testid="plan-monthly">
            <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              POPULAIR
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Maandelijks</h3>
                <p className="text-xs text-zinc-500">Onbeperkt motoren, 30 dagen</p>
              </div>
            </div>
            <p className="text-3xl font-black text-red-600 my-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              &euro;45 <span className="text-sm font-normal text-zinc-400">/ maand onbeperkt</span>
            </p>
            <ul className="text-sm text-zinc-600 space-y-2 mb-5">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Onbeperkt motoren plaatsen</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />30 dagen geldig</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Uw contactgegevens zichtbaar</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Beste waarde bij meerdere motoren</li>
            </ul>
            <Button onClick={() => handleCheckout('monthly')} className="w-full bg-red-600 hover:bg-red-700 text-white" data-testid="buy-monthly-btn">
              <CreditCard className="w-4 h-4 mr-2" /> Start Maandabonnement
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        {canUpload && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-600" /> Motor Uploaden
              </h2>
              <Button variant="outline" onClick={() => setShowForm(!showForm)} data-testid="toggle-form-btn">
                {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showForm ? 'Sluiten' : 'Nieuwe Motor'}
              </Button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="google-motor-form">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Merk *</label>
                    <select
                      value={form.brand}
                      onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      required
                      data-testid="motor-brand-select"
                    >
                      <option value="">Selecteer merk</option>
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Model *</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      placeholder="bijv. R1250GS"
                      required
                      data-testid="motor-model-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Bouwjaar *</label>
                    <input
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      min="1970" max="2030"
                      required
                      data-testid="motor-year-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Prijs (&euro;) *</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      placeholder="12500"
                      required
                      data-testid="motor-price-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Km-stand</label>
                    <input
                      type="number"
                      value={form.mileage}
                      onChange={(e) => setForm(f => ({ ...f, mileage: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      placeholder="25000"
                      data-testid="motor-mileage-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 block mb-1">Kleur</label>
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      placeholder="Zwart"
                      data-testid="motor-color-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-zinc-700 block mb-1">Omschrijving</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    rows={3}
                    placeholder="Beschrijf de motor..."
                    data-testid="motor-description-textarea"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="text-sm font-bold text-zinc-700 block mb-2">Foto's</label>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {form.images.map((img, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-zinc-200 group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 transition-colors" data-testid="image-upload-label">
                      {uploadingImages ? (
                        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-zinc-400" />
                          <span className="text-xs text-zinc-400 mt-1">Toevoegen</span>
                        </>
                      )}
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploadingImages} />
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white" data-testid="submit-motor-btn">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Motor Aanmelden
                </Button>
              </form>
            )}
          </div>
        )}

        {/* My Motors */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-lg font-bold mb-4">Mijn Google Motoren ({motors.length})</h2>
          {motors.length === 0 ? (
            <div className="text-center py-10 text-zinc-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>U heeft nog geen motoren op Google geplaatst</p>
            </div>
          ) : (
            <div className="space-y-3">
              {motors.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-colors" data-testid={`motor-${m.id}`}>
                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                    {m.images?.[0] ? (
                      <img src={m.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Bike className="w-8 h-8 text-zinc-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{m.brand} {m.model} ({m.year})</p>
                    <p className="text-sm text-red-600 font-bold">{formatPrice(m.price)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      m.status === 'approved' ? 'bg-green-100 text-green-700' :
                      m.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {m.status === 'approved' ? 'Live' : m.status === 'pending' ? 'Wachtend' : 'Afgewezen'}
                    </span>
                    <button onClick={() => handleDelete(m.id)} className="text-zinc-400 hover:text-red-600 transition-colors" data-testid={`delete-motor-${m.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
