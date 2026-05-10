import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Users, Loader2, Trash2, Search, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerDirectory() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', city: '' });
  const isAllowed = user?.email?.toLowerCase() === 'motoimportbv@gmail.com' || user?.role === 'admin' || user?.role === 'taxateur';

  const fetchCustomers = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try {
      const url = q.trim() ? `${API}/customers?q=${encodeURIComponent(q)}` : `${API}/customers`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setCustomers(res.data || []);
    } catch (e) { toast.error('Laden mislukt: ' + e.message); }
    setLoading(false);
  }, [token, q, isAllowed]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 200);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Klant '${name}' verwijderen?`)) return;
    try {
      await axios.delete(`${API}/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Klant verwijderd');
      fetchCustomers();
    } catch (e) { toast.error('Mislukt: ' + e.message); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) { toast.error('Naam is verplicht'); return; }
    try {
      await axios.post(`${API}/customers`, newCustomer, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Klant opgeslagen');
      setShowAdd(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '', city: '' });
      fetchCustomers();
    } catch (e) { toast.error('Mislukt: ' + (e.response?.data?.detail || e.message)); }
  };

  if (!isAllowed) return <Layout><div className="flex items-center justify-center h-64 text-zinc-500">Geen toegang.</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6" data-testid="customer-directory">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Users className="w-7 h-7 text-red-600" /> Mijn Klanten
            </h1>
            <p className="text-zinc-500 mt-1">{customers.length} klant{customers.length === 1 ? '' : 'en'} opgeslagen</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700 text-white" data-testid="add-customer-btn">
              <Plus className="w-4 h-4 mr-2" />Klant toevoegen
            </Button>
            <Link to="/admin/taxatie-programma">
              <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Terug</Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam, telefoon, email of stad..."
            className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-xl bg-white text-sm focus:border-red-500 focus:outline-none"
            data-testid="customer-search-input"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold mb-1">Nog geen klanten</p>
            <p className="text-sm">Klanten worden automatisch toegevoegd zodra je een factuur of taxatie aanmaakt.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Naam</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Telefoon</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">E-mail</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Adres</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Stad</th>
                  <th className="text-center px-4 py-2 text-xs font-bold uppercase text-zinc-500">Gebruikt</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`customer-row-${c.id}`}>
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.phone || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.email || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.address || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.city || '\u2014'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">{c.usage_count || 0}\u00d7</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-2 rounded-lg hover:bg-red-100 text-red-500"
                        title="Verwijderen"
                        data-testid={`delete-customer-${c.id}`}
                      ><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdd(false)} data-testid="add-customer-modal">
            <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-zinc-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-black text-zinc-900">Nieuwe klant</h2>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { k: 'name', l: 'Naam *', p: 'Jan Jansen' },
                  { k: 'phone', l: 'Telefoon', p: '06-12345678' },
                  { k: 'email', l: 'E-mail', p: 'jan@email.nl' },
                  { k: 'address', l: 'Adres', p: 'Straatnaam 1' },
                  { k: 'city', l: 'Stad', p: 'Amsterdam' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">{f.l}</label>
                    <input
                      type="text"
                      value={newCustomer[f.k]}
                      onChange={e => setNewCustomer({ ...newCustomer, [f.k]: e.target.value })}
                      placeholder={f.p}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid={`new-customer-${f.k}`}
                    />
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100">Annuleren</button>
                <button type="submit" disabled={!newCustomer.name.trim()} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50" data-testid="save-customer-btn">Opslaan</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
