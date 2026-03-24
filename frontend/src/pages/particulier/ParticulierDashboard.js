import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Bike, Plus, Clock, CheckCircle, XCircle, CreditCard, LogOut, Euro } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParticulierDashboard() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token || user.role !== 'particulier') {
      navigate('/register/particulier');
      return;
    }
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const res = await fetch(`${API}/api/private-listings/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setListings(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleCheckout = async (listingId) => {
    try {
      const res = await fetch(`${API}/api/private-listings/${listingId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ origin_url: window.location.origin }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/register/particulier');
  };

  const getStatus = (listing) => {
    if (!listing.is_paid) return { label: 'Wacht op betaling', color: 'text-yellow-400', icon: CreditCard, bg: 'bg-yellow-400/10' };
    const now = new Date();
    const expires = new Date(listing.expires_at);
    if (expires < now) return { label: 'Verlopen', color: 'text-red-400', icon: XCircle, bg: 'bg-red-400/10' };
    const days = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
    return { label: `Actief - ${days} dag${days !== 1 ? 'en' : ''} resterend`, color: 'text-green-400', icon: CheckCircle, bg: 'bg-green-400/10' };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <nav className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm">MOTO IMPORT</span>
              <span className="text-zinc-500 text-xs ml-2">Particulier</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 hidden sm:block">{user.name}</span>
            <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Mijn advertenties</h1>
            <p className="text-zinc-500 text-sm mt-1">Verkoop uw motor aan 100+ dealers in Nederland</p>
          </div>
          <Button
            data-testid="add-listing-btn"
            onClick={() => navigate('/particulier/nieuw')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-medium"
          >
            <Plus className="w-4 h-4 mr-2" /> Motor aanbieden
          </Button>
        </div>

        {/* Price info */}
        <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Euro className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-zinc-400">
            Uw motor wordt 1 week lang aangeboden aan alle aangesloten dealers voor <strong className="text-white">&euro;7,95</strong>. 
            Betaling via iDEAL of creditcard.
          </p>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-center py-16 text-zinc-500">Laden...</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <Bike className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 mb-4">U heeft nog geen advertenties</p>
            <Button
              onClick={() => navigate('/particulier/nieuw')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" /> Eerste motor aanbieden
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((l) => {
              const status = getStatus(l);
              const Icon = status.icon;
              return (
                <div key={l.id} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-testid={`listing-${l.id}`}>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white">{l.brand} {l.model}</h3>
                    <p className="text-sm text-zinc-500">{l.year} &bull; {l.mileage?.toLocaleString()} km &bull; {l.color}</p>
                    <p className="text-lg font-bold text-red-400 mt-1">&euro;{l.price?.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {status.label}
                    </div>
                    {!l.is_paid && (
                      <Button
                        data-testid={`pay-btn-${l.id}`}
                        onClick={() => handleCheckout(l.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Betalen &euro;7,95
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
