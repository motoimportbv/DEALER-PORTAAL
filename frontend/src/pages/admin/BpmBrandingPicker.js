import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import {
  X, Plus, ShieldCheck, Building2, Trash2, Loader2, ArrowRight,
  CheckCircle2, Edit3,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EMPTY_PROFILE = {
  label: '',
  company_name: '',
  address: '',
  postal_code: '',
  city: '',
  phone: '',
  email: '',
  kvk: '',
  btw: '',
  taxateur_name: '',
  taxateur_title: 'Erkend BPM-taxateur',
  linked_emails: [],
};

/**
 * Stap-1 modal: kies op welke naam het BPM-rapport moet komen.
 * Toont opgeslagen profielen (motoimport bv, Ten Kate, etc.) + knop "Nieuw profiel".
 * Bij selectie: callt onPick(profile) en sluit.
 */
export default function BpmBrandingPicker({ token, onPick, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // null | profile-object (for new/edit)
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/bpm-branding-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles(r.data?.profiles || []);
    } catch (e) {
      toast.error('Profielen laden mislukt');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);  // eslint-disable-line

  const remove = async (id) => {
    if (!window.confirm('Weet je zeker dat je dit profiel wilt verwijderen?')) return;
    try {
      await axios.delete(`${API}/admin/bpm-branding-profiles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Profiel verwijderd');
      load();
    } catch (e) {
      toast.error('Verwijderen mislukt');
    }
  };

  const save = async () => {
    if (!editing.label.trim() || !editing.company_name.trim() || !editing.taxateur_name.trim()) {
      toast.error('Label, bedrijfsnaam en taxateur-naam zijn verplicht');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/admin/bpm-branding-profiles`, editing, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Profiel opgeslagen');
      setEditing(null);
      load();
    } catch (e) {
      toast.error('Opslaan mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  // ============== EDIT/ADD VIEW ==============
  if (editing) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto p-4"
        onClick={() => setEditing(null)} data-testid="branding-edit-modal">
        <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              {editing.id ? 'Profiel bewerken' : 'Nieuw branding-profiel'}
            </h2>
            <button onClick={() => setEditing(null)} className="p-2 hover:bg-zinc-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              💡 Dit profiel verschijnt straks in de keuzelijst bij <strong>"Maak BPM-rapport"</strong>.
              De ingevulde gegevens worden automatisch op het rapport gezet (bedrijfsnaam, taxateur, KvK, etc.).
            </div>

            <PField label="Profiel-label (intern) *" value={editing.label}
              onChange={v => setEditing({ ...editing, label: v })}
              placeholder="Ten Kate Motoren" hint="Korte naam waarmee je dit profiel in de lijst herkent" />
            <div className="grid sm:grid-cols-2 gap-3">
              <PField label="Bedrijfsnaam *" value={editing.company_name}
                onChange={v => setEditing({ ...editing, company_name: v })}
                placeholder="Ten Kate Motoren BV" />
              <PField label="Naam taxateur *" value={editing.taxateur_name}
                onChange={v => setEditing({ ...editing, taxateur_name: v })}
                placeholder="J. ten Kate" hint="Komt onderaan rapport als ondertekenaar" />
              <PField label="Functie / kwalificatie" value={editing.taxateur_title}
                onChange={v => setEditing({ ...editing, taxateur_title: v })}
                placeholder="Erkend taxateur RMT/SCVM" />
              <PField label="Telefoon" value={editing.phone}
                onChange={v => setEditing({ ...editing, phone: v })}
                placeholder="+31 578 555 1234" />
              <PField label="Adres" value={editing.address}
                onChange={v => setEditing({ ...editing, address: v })}
                placeholder="Industrieweg 5" />
              <PField label="Postcode" value={editing.postal_code}
                onChange={v => setEditing({ ...editing, postal_code: v })}
                placeholder="8161 BL" />
              <PField label="Plaats" value={editing.city}
                onChange={v => setEditing({ ...editing, city: v })}
                placeholder="Epe" />
              <PField label="E-mail" value={editing.email}
                onChange={v => setEditing({ ...editing, email: v })}
                placeholder="info@tenkate.nl" />
              <PField label="KvK-nummer" value={editing.kvk}
                onChange={v => setEditing({ ...editing, kvk: v })}
                placeholder="08123456" />
              <PField label="BTW-nummer" value={editing.btw}
                onChange={v => setEditing({ ...editing, btw: v })}
                placeholder="NL811234567B01" />
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-3">
              <label className="block text-xs font-bold text-emerald-900 uppercase mb-1">
                ✨ Auto-koppelen op email (optioneel)
              </label>
              <p className="text-xs text-emerald-800 mb-2">
                Voeg de e-mailadressen toe van deze dealer. Wanneer iemand met een van deze adressen een aanvraag indient via je website, wordt dit profiel <strong>automatisch geselecteerd</strong> — je hoeft niets meer handmatig in te stellen.
              </p>
              <textarea
                value={(editing.linked_emails || []).join('\n')}
                onChange={e => setEditing({
                  ...editing,
                  linked_emails: e.target.value.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.includes('@')),
                })}
                rows={3}
                placeholder="info@bloemert.nl&#10;jan@bloemert.nl&#10;..."
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white"
                data-testid="linked-emails-textarea"
              />
              {(editing.linked_emails || []).length > 0 && (
                <p className="text-xs text-emerald-700 mt-1">
                  {editing.linked_emails.length} adres{editing.linked_emails.length !== 1 ? 'sen' : ''} gekoppeld
                </p>
              )}
            </div>
          </div>

          <div className="border-t p-4 flex items-center justify-end gap-2 bg-zinc-50 rounded-b-2xl">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Annuleren</Button>
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="save-branding-profile-btn">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Profiel opslaan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============== PICKER VIEW ==============
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose} data-testid="branding-picker-modal">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Op welke naam moet het rapport?
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Kies het bedrijf + taxateur die op het BPM-rapport komt te staan
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg" data-testid="close-branding-picker">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
            </div>
          ) : (
            <>
              {profiles.length === 0 && (
                <p className="text-center text-zinc-500 py-6 text-sm">
                  Nog geen profielen. Klik op "Nieuw profiel" hieronder om er een toe te voegen.
                </p>
              )}
              {profiles.map(p => (
                <div
                  key={p.id}
                  className="group bg-white border-2 border-zinc-200 hover:border-blue-500 rounded-xl p-4 transition-all cursor-pointer flex items-center gap-3"
                  onClick={() => onPick(p)}
                  data-testid={`branding-profile-${p.id}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-900">{p.label}</h3>
                      {p.is_default && (
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                          Standaard
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 truncate">
                      <strong>{p.company_name}</strong> · {p.taxateur_name}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {p.address ? `${p.address}, ` : ''}{p.postal_code} {p.city}
                      {p.kvk ? ` · KvK ${p.kvk}` : ''}
                    </p>
                    {(p.linked_emails || []).length > 0 && (
                      <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Auto-match op {p.linked_emails.length} email{p.linked_emails.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded"
                      title="Bewerken"
                      data-testid={`edit-branding-${p.id}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!p.is_default && (
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(p.id); }}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Verwijderen"
                        data-testid={`delete-branding-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              ))}
            </>
          )}

          <button
            onClick={() => setEditing({ ...EMPTY_PROFILE })}
            className="w-full bg-zinc-50 hover:bg-blue-50 border-2 border-dashed border-zinc-300 hover:border-blue-500 rounded-xl p-4 flex items-center justify-center gap-2 text-sm font-semibold text-zinc-600 hover:text-blue-600 transition-all"
            data-testid="add-branding-profile-btn"
          >
            <Plus className="w-4 h-4" />
            Nieuw branding-profiel toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}

function PField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  );
}
