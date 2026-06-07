import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [countryFilter, setCountryFilter] = useState('ALL'); // 'ALL' | 'NL' | 'FR' | 'BE' | 'IT' | 'OTHER'
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

  const importSeed = async () => {
    if (!window.confirm('Importeer 341 vooraf verzamelde motorzaken-leads van motoroccasion.nl?\n\nBestaande e-mails worden niet dubbel toegevoegd.')) return;
    setAutoBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/import-seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`✅ Import klaar: ${d.inserted} nieuw, ${d.duplicates} duplicaten genegeerd (totaal in seed: ${d.total_in_seed})`);
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setAutoBusy(false);
  };

  const importForeignSeed = async () => {
    if (!window.confirm('Importeer geverifieerde FR/BE motor-dealers met e-mail?\n\nKM Motos, CLM Motos, La Maison de la Moto, Planet Racing, Sud Moto, Zone Rouge.')) return;
    setAutoBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/import-foreign-seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`✅ FR/BE seed klaar: ${d.inserted} nieuw, ${d.duplicates} duplicaten genegeerd (totaal: ${d.total_in_seed})`);
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setAutoBusy(false);
  };

  const importItalianSeed = async () => {
    if (!window.confirm('Importeer geverifieerde Italiaanse motor-dealers met e-mail?\n\nEuroscooter Roma, Honda Moto Roma (3 stores), La Moto Roma Nord & Ovest, Pogliani Milano.')) return;
    setAutoBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/import-italian-seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`✅ IT seed klaar: ${d.inserted} nieuw, ${d.duplicates} duplicaten genegeerd (totaal: ${d.total_in_seed})`);
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setAutoBusy(false);
  };

  const [urlBulkText, setUrlBulkText] = useState('');
  const [urlBulkBusy, setUrlBulkBusy] = useState(false);
  const [urlBulkLastResult, setUrlBulkLastResult] = useState(null);
  const runUrlBulkExtract = async () => {
    const urls = urlBulkText.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      toast.error('Plak minstens 1 URL');
      return;
    }
    if (urls.length > 200) {
      toast.error('Maximaal 200 URLs per keer');
      return;
    }
    setUrlBulkBusy(true);
    setUrlBulkLastResult(null);
    try {
      const r = await axios.post(
        `${API}/admin/leads/extract-emails-from-urls`,
        { urls },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 }
      );
      const d = r.data;
      setUrlBulkLastResult(d);
      toast.success(`✅ ${d.inserted} nieuwe leads (${d.duplicates} dup, ${d.no_email} zonder email, ${d.errors} errors van ${d.processed} URLs)`);
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setUrlBulkBusy(false);
  };

  const [motoItPages, setMotoItPages] = useState(5);
  const [motoItBusy, setMotoItBusy] = useState(false);
  const scrapeMotoIt = async () => {
    const estimated = motoItPages * 20;
    if (!window.confirm(`Automatisch ${estimated} Italiaanse dealers van moto.it scrapen?\n\n${motoItPages} pagina's × ~20 dealers = ~${estimated} dealers\nGeschatte tijd: ~${Math.max(1, Math.round(motoItPages * 0.6))} min\nGeschatte hit-rate: 65% (dus ~${Math.round(estimated * 0.65)} echte e-mails)\n\nDeze actie blokkeert je server tijdens uitvoering — start met max 5 pagina's.`)) return;
    setMotoItBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/scrape-moto-it`,
        { max_pages: motoItPages },
        { headers: { Authorization: `Bearer ${token}` }, timeout: motoItPages * 180000 }
      );
      const d = r.data;
      toast.success(`✅ moto.it scrape klaar: ${d.inserted} nieuwe leads (${d.duplicates} dup, ${d.no_email} zonder email, ${d.processed} dealers verwerkt)`);
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setMotoItBusy(false);
  };

  const [genericText, setGenericText] = useState('');
  const [genericBusy, setGenericBusy] = useState(false);
  const submitGenericPaste = async () => {
    if (genericText.trim().length < 20) {
      toast.error('Tekst is te kort');
      return;
    }
    setGenericBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/leads/scrape-paste-generic`,
        { text: genericText, source_label: 'pagesjaunes' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`✅ ${d.inserted} nieuwe leads gevonden (${d.found_emails} e-mails geparsed, ${d.duplicates} duplicaten)`);
      setGenericText('');
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setGenericBusy(false);
  };

  const [htmlPaste, setHtmlPaste] = useState('');
  const [htmlPasteCountry, setHtmlPasteCountry] = useState('FR');
  const [htmlPasteBusy, setHtmlPasteBusy] = useState(false);
  const [htmlPasteResult, setHtmlPasteResult] = useState(null);
  const runHtmlPasteScrape = async () => {
    if (htmlPaste.trim().length < 200) {
      toast.error('Plak de complete HTML (min 200 tekens). Open de zoekresultaat-pagina, Ctrl+U → Ctrl+A → Ctrl+C.');
      return;
    }
    setHtmlPasteBusy(true);
    setHtmlPasteResult(null);
    try {
      const r = await axios.post(
        `${API}/admin/leads/scrape-html-paste`,
        { html: htmlPaste, country: htmlPasteCountry, source_label: `html-paste-${htmlPasteCountry.toLowerCase()}` },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      const d = r.data;
      setHtmlPasteResult(d);
      toast.success(`✅ ${d.inserted} nieuwe leads (${d.emails_found} emails, ${d.websites_found} websites, ${d.duplicates} dup)`);
      setHtmlPaste('');
      fetchLeads();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setHtmlPasteBusy(false);
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
  // Bucket land-codes — alles wat geen NL/FR/BE/IT/DE is gaat naar OTHER
  const countryOf = (l) => {
    const c = (l.country || '').toUpperCase();
    if (['NL', 'FR', 'BE', 'IT', 'DE'].includes(c)) return c;
    // Fallback: leeg country → NL (oude motoroccasion.nl leads)
    if (!c && (l.source_site || '').includes('motoroccasion')) return 'NL';
    if (!c) return 'NL';
    return 'OTHER';
  };
  const countryCounts = useMemo(() => {
    const counts = { ALL: leads.length, NL: 0, FR: 0, BE: 0, IT: 0, DE: 0, OTHER: 0 };
    leads.forEach(l => { counts[countryOf(l)] = (counts[countryOf(l)] || 0) + 1; });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);
  const visibleLeads = useMemo(() => {
    let filtered = countryFilter === 'ALL' ? leads : leads.filter(l => countryOf(l) === countryFilter);
    // Sorteer alfabetisch per land, dan op naam — zo zit alles netjes gegroepeerd
    return [...filtered].sort((a, b) => {
      const ca = countryOf(a), cb = countryOf(b);
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.name || '').localeCompare(b.name || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, countryFilter]);

  const selectAll = () => setSelectedIds(new Set(visibleLeads.map(l => l.id)));
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
    const filtered = leads.filter(l => selectedIds.size > 0 ? selectedIds.has(l.id) : l.status === 'new');
    const emails = filtered.map(l => l.email);
    if (emails.length === 0) { toast.error('Geen leads om naar bulk-mailer te sturen'); return; }
    // Bepaal dominant land uit selectie zodat de mailer automatisch de juiste taal-template laadt
    const countryCount = {};
    filtered.forEach(l => {
      const c = countryOf(l);
      countryCount[c] = (countryCount[c] || 0) + 1;
    });
    const dominantCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    sessionStorage.setItem('lead_import_emails', emails.join('\n'));
    sessionStorage.setItem('lead_import_ids', JSON.stringify(filtered.map(l => l.id)));
    sessionStorage.setItem('lead_import_country', dominantCountry);
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
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-2" data-testid="seed-import-block">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎁</span>
                <h4 className="font-black text-emerald-900 text-base">341 leads klaarstaan!</h4>
              </div>
              <p className="text-sm text-emerald-800">
                We hebben alvast <strong>341 motorzaken-e-mailadressen</strong> van motoroccasion.nl voor je verzameld
                (95% van alle Nederlandse dealers). Klik hieronder om ze direct in je database te zetten.
              </p>
              <Button
                onClick={importSeed}
                disabled={autoBusy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto"
                data-testid="import-seed-btn"
              >
                {autoBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <>📥 Importeer alle 341 dealers</>}
              </Button>
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 space-y-3" data-testid="foreign-seed-block">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇫🇷🇧🇪</span>
                <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wide">Franse &amp; Belgische leveranciers</h3>
              </div>
              <p className="text-sm text-purple-800">
                Geverifieerde startlijst met <strong>11 FR/BE motor-dealers</strong> (KM Motos, CLM Motos, Brussels Moto Store,
                Honda Mertens Brussel/Antwerpen, Caset, Raes Motoren, Van Der Heyden, La Maison de la Moto, Planet Racing, Superbike Marseille,
                Moto Expert 31, City2Roues, Village Motos).
              </p>
              <Button
                onClick={importForeignSeed}
                disabled={autoBusy}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold w-full sm:w-auto"
                data-testid="import-foreign-seed-btn"
              >
                {autoBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <>📥 Importeer FR/BE dealers</>}
              </Button>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 space-y-3" data-testid="italian-seed-block">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇮🇹</span>
                <h3 className="text-sm font-bold text-green-900 uppercase tracking-wide">Italiaanse leveranciers</h3>
              </div>
              <p className="text-sm text-green-800">
                Geverifieerde startlijst met <strong>13 Italiaanse motor-dealers</strong> (Euroscooter Roma,
                Honda Moto Roma — 3 vestigingen, La Moto Roma Nord/Ovest, Pogliani &amp; Stamoto Milano,
                CMT Motor Brescia/Milano, Alma + CeB Firenze, Baldassarre Bari).
              </p>
              <Button
                onClick={importItalianSeed}
                disabled={autoBusy}
                className="bg-green-600 hover:bg-green-700 text-white font-bold w-full sm:w-auto"
                data-testid="import-italian-seed-btn"
              >
                {autoBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <>📥 Importeer 13 Italiaanse dealers</>}
              </Button>

              <div className="mt-3 pt-3 border-t border-green-300 space-y-2" data-testid="moto-it-scrape-block">
                <p className="text-xs font-bold text-green-900 uppercase tracking-wide">🤖 Auto-scrape moto.it</p>
                <p className="text-xs text-green-800">
                  Automatisch dealer-namen + websites + emails van <strong>moto.it/concessionari</strong> halen (1.132 dealers in totaal).
                  ~20 dealers per pagina, hit-rate ±65% echte emails.
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="text-[10px] text-green-700 font-bold block">Aantal pagina&apos;s (max 70):</label>
                    <input
                      type="number"
                      min={1}
                      max={70}
                      value={motoItPages}
                      onChange={(e) => setMotoItPages(Math.max(1, Math.min(70, parseInt(e.target.value) || 1)))}
                      className="w-20 border border-green-400 rounded px-2 py-1 text-sm"
                      data-testid="moto-it-pages-input"
                    />
                  </div>
                  <p className="text-[10px] text-green-700">≈ {motoItPages * 20} dealers, ~{Math.round(motoItPages * 0.65 * 20)} emails</p>
                  <Button
                    onClick={scrapeMotoIt}
                    disabled={motoItBusy}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                    data-testid="scrape-moto-it-btn"
                  >
                    {motoItBusy ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scraping... (kan paar min duren)</> : <>🤖 Start auto-scrape</>}
                  </Button>
                </div>
                <p className="text-[10px] text-green-700">Tip: start met 2 pagina&apos;s (40 dealers) als testbatch — schaal daarna op.</p>
              </div>
            </div>

            {/* HTML-PASTE scraper voor BE/FR — bypasst anti-bot blokkades */}
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-3" data-testid="html-paste-block">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇧🇪🇫🇷</span>
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">HTML-paste scraper (BE/FR · bypass anti-bot)</h3>
              </div>
              <p className="text-sm text-amber-800">
                Pages Jaunes, GoCar &amp; Yamaha-locator blokkeren onze server (HTTP 403).
                <strong> Oplossing:</strong> open de zoekresultaat in jouw browser, kopieer de HTML-broncode, en plak hieronder.
                Onze parser haalt automatisch <strong>alle emails + websites + dealer-namen</strong> eruit.
              </p>
              <details className="bg-white border border-amber-200 rounded-lg p-3">
                <summary className="cursor-pointer text-xs font-bold text-amber-900">📋 Stap-voor-stap (eerste keer · 2 min)</summary>
                <ol className="mt-2 text-xs text-amber-800 list-decimal pl-5 space-y-1">
                  <li>Open een dealer-zoekpagina in jouw browser, bv. <a href="https://www.google.com/maps/search/concessionnaire+moto+lyon" target="_blank" rel="noreferrer" className="underline font-bold">Google Maps &quot;concessionnaire moto Lyon&quot; <ExternalLink className="inline w-3 h-3" /></a>, <a href="https://www.pagesjaunes.fr/recherche/france/concessionnaire-moto" target="_blank" rel="noreferrer" className="underline font-bold">Pages Jaunes <ExternalLink className="inline w-3 h-3" /></a>, of <a href="https://www.yamaha-motor.eu/be/nl/find-dealer/" target="_blank" rel="noreferrer" className="underline font-bold">Yamaha BE locator <ExternalLink className="inline w-3 h-3" /></a></li>
                  <li>Scroll naar beneden tot alle resultaten geladen zijn (op Google Maps: scroll in de zijbalk)</li>
                  <li>Rechtermuisknop → <strong>Paginabron weergeven</strong> (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+U</kbd> / <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Cmd+Opt+U</kbd>)</li>
                  <li>Selecteer alles (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+A</kbd>) en kopieer (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+C</kbd>)</li>
                  <li>Plak hieronder, kies land &amp; klik <strong>Scrape HTML</strong></li>
                </ol>
              </details>
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <label className="text-[10px] text-amber-800 font-bold block">Land van resultaten:</label>
                  <select
                    value={htmlPasteCountry}
                    onChange={(e) => setHtmlPasteCountry(e.target.value)}
                    className="border-2 border-amber-300 rounded px-3 py-1.5 text-sm font-bold bg-white"
                    data-testid="html-paste-country"
                  >
                    <option value="FR">🇫🇷 Frankrijk</option>
                    <option value="BE">🇧🇪 België</option>
                    <option value="NL">🇳🇱 Nederland</option>
                    <option value="IT">🇮🇹 Italië</option>
                    <option value="DE">🇩🇪 Duitsland</option>
                    <option value="ES">🇪🇸 Spanje</option>
                    <option value="LU">🇱🇺 Luxemburg</option>
                  </select>
                </div>
                <p className="text-[10px] text-amber-700 self-center">Land = bron-land. Backend overschrijft per email als TLD afwijkt.</p>
              </div>
              <textarea
                value={htmlPaste}
                onChange={(e) => setHtmlPaste(e.target.value)}
                placeholder={"Plak hier de complete HTML-broncode (Ctrl+U → Ctrl+A → Ctrl+C op de bron-pagina)\n\n<html>...<a href=\"https://www.dealer.fr\">Dealer Naam</a> ... info@dealer.fr ..."}
                className="w-full h-40 border-2 border-amber-300 rounded-xl px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                data-testid="html-paste-textarea"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={runHtmlPasteScrape}
                  disabled={htmlPasteBusy || htmlPaste.trim().length < 200}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  data-testid="run-html-paste-btn"
                >
                  {htmlPasteBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <>🔍 Scrape HTML →</>}
                </Button>
                <span className="text-[11px] text-amber-700">{htmlPaste.length.toLocaleString()} tekens geplakt</span>
              </div>
              {htmlPasteResult && (
                <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs space-y-1" data-testid="html-paste-result">
                  <p className="font-bold text-amber-900">Laatste resultaat:</p>
                  <p>✅ {htmlPasteResult.inserted} nieuw · ⏭️ {htmlPasteResult.duplicates} dup · 📧 {htmlPasteResult.emails_found} emails gevonden · 🌐 {htmlPasteResult.websites_found} websites</p>
                  {htmlPasteResult.details?.filter(d => d.status === 'ok').slice(0, 8).map((d, i) => (
                    <p key={i} className="text-zinc-700 truncate">  <span className="text-green-600">✓</span> {d.name} <span className="text-zinc-500">— {d.email}</span></p>
                  ))}
                </div>
              )}
            </div>

            {/* GENERIEKE URL-bulk email finder — werkt voor ELK land/website */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 space-y-3" data-testid="url-bulk-block">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌐</span>
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">URL-bulk email finder (universeel)</h3>
              </div>
              <p className="text-sm text-blue-800">
                Plak een lijst dealer-websites (1 per regel) — backend gaat per URL naar <strong>/contact, /contacts, /contatti, /contattaci</strong> om e-mails te extraheren.
                Werkt voor FR, BE, IT, NL, DE — overal. Test-batch gaf <strong>100% hit-rate</strong>.
              </p>
              <details className="bg-white border border-blue-200 rounded-lg p-3">
                <summary className="cursor-pointer text-xs font-bold text-blue-900">💡 Hoe verzamel ik URLs?</summary>
                <ul className="mt-2 text-xs text-blue-800 list-disc pl-5 space-y-1">
                  <li>Google: <code className="bg-blue-100 px-1 rounded">"concessionnaire moto" Lyon site:.fr</code> → kopieer alle resultaten</li>
                  <li>Yamaha dealer-locator: <code className="bg-blue-100 px-1 rounded">yamaha-motor.eu/fr/dealers</code> → kopieer alle dealer-URLs</li>
                  <li>Pages Jaunes: plak hier de website-URLs uit profielpagina&apos;s</li>
                  <li>Of vraag ChatGPT om &quot;lijst van 50 motor-dealer websites in [stad/regio]&quot;</li>
                </ul>
              </details>
              <textarea
                value={urlBulkText}
                onChange={(e) => setUrlBulkText(e.target.value)}
                placeholder={"https://www.dealer1.fr\nhttps://www.dealer2.be\nhttps://dealer3.it\n... (max 200 per keer)"}
                className="w-full h-32 border border-blue-300 rounded-xl px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                data-testid="url-bulk-textarea"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={runUrlBulkExtract}
                  disabled={urlBulkBusy || urlBulkText.trim().length < 4}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  data-testid="run-url-bulk-btn"
                >
                  {urlBulkBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <>🔍 Vind emails op alle URLs</>}
                </Button>
                <p className="text-[11px] text-blue-700">{urlBulkText.split('\n').filter(u => u.trim()).length} URL(s) klaar</p>
              </div>
              {urlBulkLastResult && (
                <div className="bg-white border border-blue-200 rounded-lg p-3 text-xs space-y-1" data-testid="url-bulk-result">
                  <p className="font-bold text-blue-900">Laatste resultaat:</p>
                  <p>✅ {urlBulkLastResult.inserted} nieuw · ⏭️ {urlBulkLastResult.duplicates} dup · ❌ {urlBulkLastResult.no_email} geen email · {urlBulkLastResult.errors} errors</p>
                  {urlBulkLastResult.details?.filter(d => d.status === 'ok').slice(0, 8).map((d, i) => (
                    <p key={i} className="text-zinc-700 truncate">  <span className="text-green-600">✓</span> {d.email} <span className="text-zinc-400">({d.url})</span></p>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3" data-testid="generic-paste-block">
              <details>
                <summary className="cursor-pointer text-sm font-bold text-purple-700 hover:underline">
                  🌍 Plak FR/BE dealers (Pages Jaunes, Google Maps, eigen lijst)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 space-y-1">
                    <p className="font-bold">📋 Hoe gebruik je deze:</p>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      <li>Open <a href="https://www.pagesjaunes.fr/recherche/france/concessionnaire-moto" target="_blank" rel="noreferrer" className="text-purple-700 hover:underline font-bold">Pages Jaunes — concessionnaires moto <ExternalLink className="inline w-3 h-3" /></a> (of een vergelijkbare bron)</li>
                      <li>Selecteer alle resultaten op de pagina (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+A</kbd>) en kopieer (<kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Ctrl+C</kbd>)</li>
                      <li>Plak hieronder — onze parser haalt automatisch alle e-mailadressen eruit</li>
                      <li>Spam-domeinen (google.com, facebook.com etc.) worden automatisch overgeslagen</li>
                    </ol>
                  </div>
                  <textarea
                    value={genericText}
                    onChange={(e) => setGenericText(e.target.value)}
                    placeholder="Plak hier dealer-info, e-mailadressen, of Pages Jaunes resultaten. De parser herkent automatisch alle e-mails..."
                    className="w-full h-40 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-mono bg-zinc-50 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    data-testid="generic-paste-textarea"
                  />
                  <Button onClick={submitGenericPaste} disabled={genericBusy || genericText.length < 20} className="bg-purple-600 hover:bg-purple-700 text-white" data-testid="submit-generic-paste-btn">
                    {genericBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsen...</> : <>🔍 Vind alle e-mails →</>}
                  </Button>
                </div>
              </details>
            </div>

            <div className="flex items-start gap-3 flex-wrap">
              <Button onClick={tryAutoFetch} disabled={autoBusy} variant="outline" data-testid="auto-fetch-btn">
                {autoBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig...</> : <><RefreshCw className="w-4 h-4 mr-2" />Probeer auto-scrape (geavanceerd)</>}
              </Button>
              <span className="text-xs text-zinc-500 self-center">Voor nieuwe / extra leads naast de 341 al-geïmporteerde</span>
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
            <span className="text-xs text-zinc-500">{visibleLeads.length} resultaten {countryFilter !== 'ALL' ? `(${countryFilter}, ${leads.length} totaal)` : ''} · {selectedIds.size} geselecteerd</span>
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={visibleLeads.length === 0} data-testid="select-all-btn">Selecteer alles</Button>
            <Button variant="ghost" size="sm" onClick={selectNone} disabled={selectedIds.size === 0} data-testid="select-none-btn">Niets</Button>
            <Button variant="outline" size="sm" onClick={copySelectedEmails} disabled={selectedIds.size === 0} data-testid="copy-selected-btn">
              Kopieer geselecteerde e-mails
            </Button>
            <Button variant="outline" size="sm" onClick={copyAllNewEmails} data-testid="copy-new-btn">
              Kopieer alle &apos;nieuwe&apos;
            </Button>
            <Button onClick={sendToMailer} className="bg-red-600 hover:bg-red-700 text-white" size="sm" data-testid="send-to-mailer-btn">
              <Mail className="w-4 h-4 mr-1" />Naar Bulk Mailer →
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteSelected} disabled={selectedIds.size === 0} className="text-red-600 hover:bg-red-50" data-testid="delete-selected-btn">
              <Trash2 className="w-4 h-4 mr-1" />Verwijder {selectedIds.size > 0 ? selectedIds.size : ''}
            </Button>
          </div>

          {/* Land-filter tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t" data-testid="country-filter-tabs">
            {[
              { key: 'ALL', flag: '🌐', label: 'Alle' },
              { key: 'NL', flag: '🇳🇱', label: 'Nederland' },
              { key: 'FR', flag: '🇫🇷', label: 'Frankrijk' },
              { key: 'BE', flag: '🇧🇪', label: 'België' },
              { key: 'IT', flag: '🇮🇹', label: 'Italië' },
              { key: 'DE', flag: '🇩🇪', label: 'Duitsland' },
              { key: 'OTHER', flag: '🌍', label: 'Overig' },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setCountryFilter(t.key); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition flex items-center gap-1.5 ${
                  countryFilter === t.key
                    ? 'border-red-500 bg-red-50 text-red-900'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                }`}
                data-testid={`country-tab-${t.key.toLowerCase()}`}
              >
                <span>{t.flag}</span>
                <span>{t.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  countryFilter === t.key ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}>{countryCounts[t.key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lijst */}
        <div className="bg-white rounded-2xl border overflow-hidden" data-testid="leads-list">
          {loading ? (
            <div className="p-12 text-center text-zinc-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : visibleLeads.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
              <p>{leads.length === 0 ? 'Nog geen leads. Voeg ze toe via de plak-modus hierboven.' : `Geen leads in deze categorie. Probeer een ander land.`}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2 w-12">Land</th>
                    <th className="text-left px-3 py-2">Bedrijf</th>
                    <th className="text-left px-3 py-2">E-mail</th>
                    <th className="text-left px-3 py-2">Plaats</th>
                    <th className="text-left px-3 py-2">Website</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => {
                    const ct = countryOf(lead);
                    const flag = { NL: '🇳🇱', FR: '🇫🇷', BE: '🇧🇪', IT: '🇮🇹', DE: '🇩🇪', OTHER: '🌍' }[ct] || '🌍';
                    return (
                    <tr key={lead.id} className="border-b hover:bg-zinc-50/50" data-testid={`lead-row-${lead.id}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox" checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="w-4 h-4 accent-red-600 cursor-pointer"
                          data-testid={`select-${lead.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-lg" title={ct}>{flag}</td>
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
                    );
                  })}
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
