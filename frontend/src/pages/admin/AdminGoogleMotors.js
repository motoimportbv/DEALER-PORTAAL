import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { Globe, Check, X, Clock, Bike, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

export default function AdminGoogleMotors() {
  const { token } = useAuth();
  const [motors, setMotors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [expandedMotor, setExpandedMotor] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchMotors = async () => {
    try {
      const res = await axios.get(`${API}/google-motors/all`, { headers });
      setMotors(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMotors(); }, []);

  const handleApprove = async (motorId) => {
    try {
      await axios.post(`${API}/google-motors/${motorId}/approve`, {}, { headers });
      toast.success('Motor goedgekeurd en live op Google!');
      fetchMotors();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fout bij goedkeuren');
    }
  };

  const handleReject = async (motorId) => {
    const reason = prompt('Reden voor afwijzing (optioneel):');
    try {
      await axios.post(`${API}/google-motors/${motorId}/reject`, { reason }, { headers });
      toast.success('Motor afgewezen');
      fetchMotors();
    } catch (e) {
      toast.error('Fout bij afwijzen');
    }
  };

  const filtered = motors.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const pendingCount = motors.filter(m => m.status === 'pending').length;
  const approvedCount = motors.filter(m => m.status === 'approved').length;

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
      <div className="space-y-6" data-testid="admin-google-motors">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            <Globe className="w-7 h-7 text-red-600" />
            Google Motoren Beheer
          </h1>
          <p className="text-zinc-500 mt-1">Goedkeuren en beheren van dealer motoren voor Google</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter('pending')}
            className={`p-4 rounded-xl border-2 transition-colors text-left ${filter === 'pending' ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 bg-white'}`}
            data-testid="filter-pending"
          >
            <p className="text-xs font-bold text-zinc-500 uppercase">Wachtend</p>
            <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{pendingCount}</p>
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`p-4 rounded-xl border-2 transition-colors text-left ${filter === 'approved' ? 'border-green-400 bg-green-50' : 'border-zinc-200 bg-white'}`}
            data-testid="filter-approved"
          >
            <p className="text-xs font-bold text-zinc-500 uppercase">Live</p>
            <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{approvedCount}</p>
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`p-4 rounded-xl border-2 transition-colors text-left ${filter === 'all' ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200 bg-white'}`}
            data-testid="filter-all"
          >
            <p className="text-xs font-bold text-zinc-500 uppercase">Totaal</p>
            <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{motors.length}</p>
          </button>
        </div>

        {/* Motor List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center text-zinc-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Geen motoren in deze categorie</p>
            </div>
          ) : (
            filtered.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden" data-testid={`admin-motor-${m.id}`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-28 h-20 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                      {m.images?.[0] ? (
                        <img src={m.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Bike className="w-10 h-10 text-zinc-300" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{m.brand} {m.model} ({m.year})</h3>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          m.status === 'approved' ? 'bg-green-100 text-green-700' :
                          m.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {m.status === 'approved' ? 'Live' : m.status === 'pending' ? 'Wachtend' : 'Afgewezen'}
                        </span>
                      </div>
                      <p className="text-red-600 font-bold text-lg">{formatPrice(m.price)}</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Dealer: <span className="font-semibold text-zinc-700">{m.dealer_company || m.dealer_email}</span>
                        {m.dealer_city && ` - ${m.dealer_city}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(m.id)} className="bg-green-600 hover:bg-green-700 text-white" data-testid={`approve-${m.id}`}>
                            <Check className="w-4 h-4 mr-1" /> Goedkeuren
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(m.id)} className="text-red-600 border-red-300 hover:bg-red-50" data-testid={`reject-${m.id}`}>
                            <X className="w-4 h-4 mr-1" /> Afwijzen
                          </Button>
                        </>
                      )}
                      <button onClick={() => setExpandedMotor(expandedMotor === m.id ? null : m.id)} className="text-zinc-400 hover:text-zinc-600">
                        {expandedMotor === m.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedMotor === m.id && (
                  <div className="border-t border-zinc-100 p-5 bg-zinc-50">
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">Km-stand: <span className="text-zinc-800 font-semibold">{m.mileage?.toLocaleString('nl-NL') || '0'} km</span></p>
                        <p className="text-zinc-500">Kleur: <span className="text-zinc-800 font-semibold">{m.color || '-'}</span></p>
                        <p className="text-zinc-500">Plan: <span className="text-zinc-800 font-semibold">{m.plan === 'monthly' ? 'Maandelijks' : 'Per motor'}</span></p>
                        <p className="text-zinc-500">Verloopt: <span className="text-zinc-800 font-semibold">{m.expires_at ? new Date(m.expires_at).toLocaleDateString('nl-NL') : '-'}</span></p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Email: <span className="text-zinc-800 font-semibold">{m.dealer_email}</span></p>
                        <p className="text-zinc-500">Telefoon: <span className="text-zinc-800 font-semibold">{m.dealer_phone || '-'}</span></p>
                        <p className="text-zinc-500">Contactpersoon: <span className="text-zinc-800 font-semibold">{m.dealer_contact_person || '-'}</span></p>
                      </div>
                    </div>
                    {m.description && (
                      <div className="mt-3">
                        <p className="text-zinc-500 text-sm">Omschrijving:</p>
                        <p className="text-sm text-zinc-800 mt-1">{m.description}</p>
                      </div>
                    )}
                    {m.images?.length > 1 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
