import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Globe, Trash2, Download, RefreshCw, Loader2, Search,
  CheckCircle2, ExternalLink, AlertTriangle, ClipboardPaste, Mail, Building2,
  Copy, Check,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LeadScraper() {
  const { user, token } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, new: 0, sent: 0, bounced: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [pasteHtml, setPasteHtml] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const r = await axios.get(`${API}/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeads(r.data?.leads || []);
      setStats(r.data?.stats || { total: 0, new: 0, sent: 0, bounced: 0 });
    } catch (e) {
      toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [token, search, statusFilter]);

  useEffect(() => {
    if (isAllowed && token) fetchLeads();
  }, [fetchLeads, isAllowed, token]);

  const submitPaste = async () => {
    if (pasteHtml.trim().length < 200) {
      toast.error('Plak de complete HTML van de pagina (rechtermuisknop → Paginabron / View Source).');
      return;
    }
    setPasteBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/scrape-paste`,
        { html: pasteHtml },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`Geparset: ${d.parsed} · Nieuw: ${d.inserted} · Duplicaat: ${d.duplicates}${d.skipped_no_email ? ' · Geen e-mail: ' + d.skipped_no_email : ''}`);
      setPasteHtml('');
      fetchLeads();
    } catch (e) {
      toast.error('Verwerken mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setPasteBusy(false);
  };

  const tryAutoFetch = async () => {
    setAutoBusy(true);
    let totalNew = 0;
    let totalDup = 0;
    let pagesOk = 0;
    let lastError = '';
    // Probeer pagina 1 t/m 18
    for (let page = 1; page <= 18; page++) {
      try {
        const r = await axios.post(
          `${API}/admin/leads/auto-fetch`,
          { page },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (r.data?.ok) {
          totalNew += r.data.inserted || 0;
          totalDup += r.data.duplicates || 0;
          pagesOk += 1;
        } else {
          lastError = r.data?.error || 'Onbekende fout';
          break;
        }
      } catch (e) {
        lastError = e.response?.data?.detail || e.message;
        break;
      }
    }
    if (pagesOk > 0) {
      toast.success(`Auto-fetch klaar: ${pagesOk} pagina's · ${totalNew} nieuw · ${totalDup} duplicaat`);
      fetchLeads();
    } else {
      toast.warning(`Auto-fetch lukt niet: ${lastError}. Gebruik de plak-HTML modus hieronder.`);
    }
    setAutoBusy(false);
  };

  const deleteOne = async (id) => {
    if (!window.confirm('Lead verwijderen?')) return;
    try {
      await axios.delete(`${API}/admin/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Verwijderd');
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(leads.map(l => l.id)));
  const selectNone = () => setSelectedIds(new Set());

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} leads verwijderen?`)) return;
    try {
      const r = await axios.post(
        `${API}/admin/leads/delete-bulk`,
        { ids: Array.from(selectedIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${r.data.deleted} verwijderd`);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  const copySelectedEmails = () => {
    const emails = leads.filter(l => selectedIds.has(l.id)).map(l => l.email).join('\n');
    if (!emails) { toast.error('Selecteer eerst leads'); return; }
    navigator.clipboard.writeText(emails).then(() => toast.success(`${selectedIds.size} adressen gekopieerd`));
  };

  const copyAllNewEmails = () => {
    const emails = leads.filter(l => l.status === 'new').map(l => l.email).join('\n');
    if (!emails) { toast.error("Geen 'new' leads"); return; }
    navigator.clipboard.writeText(emails).then(() => toast.success(`${emails.split('\n').length} nieuwe adressen gekopieerd`));
  };

  const sendToMailer = () => {
    const emails = leads.filter(l => selectedIds.size > 0 ? selectedIds.has(l.id) : l.status === 'new').map(l => l.email);
    if (emails.length === 0) { toast.error('Geen leads om naar bulk-mailer te sturen'); return; }
    // Sla op in sessionStorage zodat TaxatieSalesMail het op kan halen
    sessionStorage.setItem('lead_import_emails', emails.join('\n'));
    sessionStorage.setItem('lead_import_ids', JSON.stringify(leads.filter(l => emails.includes(l.email)).map(l => l.id)));
    window.location.href = '/admin/taxatie-sales-mail?import=leads';
  };

  const downloadCsv = () => {
    const url = `${API}/admin/leads/export.csv${statusFilter ? '?status=' + statusFilter : ''}`;
    // Token in header → gebruik fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `taxatie_leads_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      })
      .catch(e => toast.error('Download mislukt: ' + e.message));
  };

  if (!isAllowed) {
    return <Layout><div className="p-10 text-center text-zinc-500">Geen toegang</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="lead-scraper-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Globe className="w-7 h-7 text-red-600" /> Lead-scraper · motoroccasion.nl
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Verzamel motorzaken-e-mailadressen van motoroccasion.nl en stuur ze direct naar je bulk-mailer.</p>
          </div>
          <Link to="/admin/taxatie-sales-mail">
            <Button variant="outline" data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />Naar Bulk Mailer
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="stats-block">
          <StatTile label="Totaal" value={stats.total} color="zinc" />
          <StatTile label="Nieuw (te mailen)" value={stats.new} color="emerald" />
          <StatTile label="Verstuurd" value={stats.sent} color="blue" />
          <StatTile label="Bounced" value={stats.bounced} color="amber" />
        </div>

        {/* Scrape controls */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" data-testid="scrape-block">
          <h3 className="font-bold flex items-center gap-2 text-zinc-900">
            <ClipboardPaste className="w-4 h-4 text-red-600" />Leads toevoegen
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3 flex-wrap">
              <Button onClick={tryAutoFetch} disabled={autoBusy} className="bg-zinc-800 hover:bg-zinc-900 text-white" data-testid="auto-fetch-btn">
                {autoBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig (alle 18 pagina's)...</> : <><RefreshCw className="w-4 h-4 mr-2" />Probeer automatisch ophalen</>}
              </Button>
              <span className="text-xs text-zinc-500 self-center">⚠️ Werkt alleen als de server toegang heeft (motoroccasion.nl blokkeert vaak bots). Anders gebruik magisch script of plak-modus →</span>
            </div>

            <div className="border-t pt-3" data-testid="magic-script-block">
              <details open>
                <summary className="cursor-pointer text-sm font-bold text-emerald-700 hover:underline">
                  🪄 Magisch script (aanbevolen — alle 358 dealers in 1 klik)
                </summary>
                <MagicScript token={token} apiBase={API} />
              </details>
            </div>

            <div className="border-t pt-3" data-testid="paste-mode-block">
              <details>
                <summary className="cursor-pointer text-sm font-bold text-red-600 hover:underline">
                  📋 Plak-modus (altijd werkend — open de bron-pagina handmatig)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
                    <p className="font-bold">📋 Stap-voor-stap:</p>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      <li>Open <a href="https://www.motoroccasion.nl/adressen/dealers.html" target="_blank" rel="noreferrer" className="text-red-600 hover:underline font-bold">motoroccasion.nl/adressen/dealers.html <ExternalLink className="inline w-3 h-3" /></a></li>
                      <li>Rechtermuisknop → <strong>Paginabron weergeven</strong> (of <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+U</kbd> / <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Cmd+U</kbd>)</li>
                      <li>Selecteer alles (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+A</kbd>) en kopieer (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+C</kbd>)</li>
                      <li>Plak hieronder en klik op <strong>Verwerk HTML</strong></li>
                      <li>Klik in de browser op pagina 2, 3, ... en herhaal (18 pagina's totaal · ~358 dealers)</li>
                    </ol>
                  </div>
                  <textarea
                    value={pasteHtml}
                    onChange={(e) => setPasteHtml(e.target.value)}
                    placeholder="Plak hier de complete HTML-broncode van een dealer-overzicht pagina..."
                    className="w-full h-40 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-mono bg-zinc-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    data-testid="paste-textarea"
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={submitPaste} disabled={pasteBusy || pasteHtml.length < 200} className="bg-red-600 hover:bg-red-700 text-white" data-testid="submit-paste-btn">
                      {pasteBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verwerken...</> : <>Verwerk HTML →</>}
                    </Button>
                    <span className="text-xs text-zinc-400">{pasteHtml.length.toLocaleString()} tekens geplakt</span>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Filters + Actions */}
        <div className="bg-white rounded-2xl border p-4 space-y-3" data-testid="leads-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text" placeholder="Zoek op naam, e-mail of plaats..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-red-500 focus:outline-none"
                data-testid="search-input"
              />
            </div>
            <select
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm"
              data-testid="status-filter"
            >
              <option value="">Alle statussen</option>
              <option value="new">Nieuw</option>
              <option value="sent">Verstuurd</option>
              <option value="bounced">Bounced</option>
              <option value="skipped">Overgeslagen</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchLeads} data-testid="refresh-btn">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Ververs
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv} data-testid="csv-btn">
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <span className="text-xs text-zinc-500">{leads.length} resultaten · {selectedIds.size} geselecteerd</span>
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={leads.length === 0} data-testid="select-all-btn">Selecteer alles</Button>
            <Button variant="ghost" size="sm" onClick={selectNone} disabled={selectedIds.size === 0} data-testid="select-none-btn">Niets</Button>
            <Button variant="outline" size="sm" onClick={copySelectedEmails} disabled={selectedIds.size === 0} data-testid="copy-selected-btn">
              Kopieer geselecteerde e-mails
            </Button>
            <Button variant="outline" size="sm" onClick={copyAllNewEmails} data-testid="copy-new-btn">
              Kopieer alle 'nieuwe'
            </Button>
            <Button onClick={sendToMailer} className="bg-red-600 hover:bg-red-700 text-white" size="sm" data-testid="send-to-mailer-btn">
              <Mail className="w-4 h-4 mr-1" />Naar Bulk Mailer →
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteSelected} disabled={selectedIds.size === 0} className="text-red-600 hover:bg-red-50" data-testid="delete-selected-btn">
              <Trash2 className="w-4 h-4 mr-1" />Verwijder {selectedIds.size > 0 ? selectedIds.size : ''}
            </Button>
          </div>
        </div>

        {/* Lijst */}
        <div className="bg-white rounded-2xl border overflow-hidden" data-testid="leads-list">
          {loading ? (
            <div className="p-12 text-center text-zinc-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
              <p>Nog geen leads. Voeg ze toe via de plak-modus hierboven.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Bedrijf</th>
                    <th className="text-left px-3 py-2">E-mail</th>
                    <th className="text-left px-3 py-2">Plaats</th>
                    <th className="text-left px-3 py-2">Website</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="border-b hover:bg-zinc-50/50" data-testid={`lead-row-${lead.id}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox" checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="w-4 h-4 accent-red-600 cursor-pointer"
                          data-testid={`select-${lead.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-zinc-900">{lead.name}</td>
                      <td className="px-3 py-2">
                        <a href={`mailto:${lead.email}`} className="text-red-600 hover:underline">{lead.email}</a>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{lead.city || '-'}</td>
                      <td className="px-3 py-2 text-zinc-500">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-zinc-900 inline-flex items-center gap-1 max-w-[180px] truncate">
                            <ExternalLink className="w-3 h-3" />{lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        ) : <span className="text-zinc-300">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => deleteOne(lead.id)} className="text-zinc-400 hover:text-red-600" data-testid={`delete-${lead.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2" data-testid="disclaimer">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Let op:</strong> Alleen verzamelen voor B2B-doeleinden (zakelijke prospects). Bewaar opt-out
            verzoeken nauwkeurig en respecteer AVG/GDPR. Stuur niet vaker dan 1× per maand naar hetzelfde adres.
          </span>
        </div>
      </div>
    </Layout>
  );
}

function StatTile({ label, value, color }) {
  const colors = {
    zinc: 'bg-zinc-50 border-zinc-200 text-zinc-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return (
    <div className={`${colors[color]} border rounded-xl p-3`}>
      <p className="text-[11px] uppercase tracking-wider font-bold opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    new: { bg: 'bg-emerald-100 text-emerald-700', label: 'Nieuw' },
    sent: { bg: 'bg-blue-100 text-blue-700', label: 'Verstuurd' },
    bounced: { bg: 'bg-amber-100 text-amber-700', label: 'Bounced' },
    skipped: { bg: 'bg-zinc-100 text-zinc-500', label: 'Skip' },
  };
  const cfg = map[status] || { bg: 'bg-zinc-100 text-zinc-500', label: status };
  return (
    <span className={`${cfg.bg} text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1`}>
      {status === 'sent' && <CheckCircle2 className="w-3 h-3" />}{cfg.label}
    </span>
  );
}


function MagicScript({ token, apiBase }) {
  const [copied, setCopied] = useState(false);
  const script = `(async () => {
  const API = '${apiBase}/admin/leads/scrape-paste';
  const T = '${token}';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // Zet max op 50 per pagina voor minder klikken (8 pagina's ipv 18)
  try {
    const sel = document.querySelector('#maxstepper');
    if (sel && sel.value !== '50') { sel.value = '50'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(2000); }
  } catch (e) {}
  let totalNew = 0, totalDup = 0;
  for (let p = 1; p <= 20; p++) {
    if (p > 1) {
      const btns = Array.from(document.querySelectorAll('button.pagination'));
      const next = btns.find(b => b.textContent.trim() === String(p));
      if (!next) { console.log('%c✅ Klaar — geen pagina ' + p + ' meer', 'color:green;font-weight:bold'); break; }
      next.click();
      await wait(2200);
    }
    const html = document.documentElement.outerHTML;
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + T },
      body: JSON.stringify({ html })
    });
    const j = await res.json();
    totalNew += j.inserted || 0;
    totalDup += j.duplicates || 0;
    console.log('%cPagina ' + p + ':', 'color:blue;font-weight:bold', j);
  }
  console.log('%c🎉 TOTAAL: ' + totalNew + ' nieuwe leads, ' + totalDup + ' duplicaten', 'color:green;font-size:14px;font-weight:bold');
  alert('✅ Klaar! ' + totalNew + ' nieuwe leads toegevoegd, ' + totalDup + ' duplicaten genegeerd. Ga terug naar Moto Import.');
})();`;

  const copy = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      toast.success('Script gekopieerd — plak nu in console van motoroccasion.nl');
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
        <p className="font-bold">⚡ Snelste methode — alle dealers in één keer:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Klik <strong>"Kopieer script"</strong> hieronder</li>
          <li>Open <a href="https://www.motoroccasion.nl/adressen/dealers.html" target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline font-bold">motoroccasion.nl/adressen/dealers.html <ExternalLink className="inline w-3 h-3" /></a> in een nieuw tabblad</li>
          <li>Druk op <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">F12</kbd> (of <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Cmd+Opt+I</kbd> op Mac) → tab <strong>Console</strong></li>
          <li>Plak het script en druk op <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Enter</kbd></li>
          <li>Wacht ~30 seconden — het script klikt alle pagina's door en stuurt elke pagina naar je database</li>
          <li>Kom terug hier en ververs — alle ~358 dealers staan erin ✨</li>
        </ol>
      </div>
      <div className="relative">
        <pre className="bg-zinc-900 text-emerald-300 text-[10px] font-mono p-3 rounded-xl overflow-x-auto max-h-32" data-testid="magic-script-code">
          {script.substring(0, 200)}...
        </pre>
        <Button
          onClick={copy}
          size="sm"
          className="absolute top-2 right-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="copy-magic-btn"
        >
          {copied ? <><Check className="w-3 h-3 mr-1" />Gekopieerd</> : <><Copy className="w-3 h-3 mr-1" />Kopieer script</>}
        </Button>
      </div>
      <p className="text-[11px] text-zinc-500">
        ⚠️ Het script gebruikt jouw login-token (1u geldig). Voer alleen scripts uit die je vertrouwt — dit script doet niets anders dan dealer-data van motoroccasion.nl doorsturen naar jouw eigen admin-API.
      </p>
    </div>
  );
}
