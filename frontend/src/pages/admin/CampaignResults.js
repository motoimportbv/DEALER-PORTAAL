import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, BarChart3, Mail, Eye, RefreshCw, Loader2, ChevronDown,
  CheckCircle2, Clock, ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CampaignResults() {
  const { user, token } = useAuth();
  const [batches, setBatches] = useState([]);
  const [totals, setTotals] = useState({ total_sent: 0, total_opened: 0, overall_open_rate: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState({});

  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/campaign-results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBatches(r.data?.batches || []);
      setTotals(r.data?.totals || { total_sent: 0, total_opened: 0, overall_open_rate: 0 });
    } catch (e) {
      toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (isAllowed && token) fetchData();
  }, [fetchData, isAllowed, token]);

  const loadDetails = async (batchId) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);
    if (batchDetails[batchId]) return;
    try {
      const r = await axios.get(`${API}/admin/campaign-results/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBatchDetails({ ...batchDetails, [batchId]: r.data });
    } catch (e) {
      toast.error('Details laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('nl-NL', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso.slice(0, 16); }
  };

  if (!isAllowed) {
    return <Layout><div className="p-10 text-center text-zinc-500">Geen toegang</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="campaign-results-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <BarChart3 className="w-7 h-7 text-red-600" /> Campagne Resultaten
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Zie wie je sales-mailings heeft geopend en hoe effectief je outreach is.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} data-testid="refresh-btn">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Ververs
            </Button>
            <Link to="/admin/taxatie-sales-mail">
              <Button variant="outline" data-testid="back-btn">
                <ArrowLeft className="w-4 h-4 mr-2" />Naar Bulk Mailer
              </Button>
            </Link>
          </div>
        </div>

        {/* Totals tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="totals-block">
          <StatTile icon={Mail} label="Totaal verstuurd" value={totals.total_sent} color="zinc" />
          <StatTile icon={Eye} label="Geopend (uniek)" value={totals.total_opened} color="emerald" />
          <StatTile icon={BarChart3} label="Open rate" value={`${totals.overall_open_rate}%`} color="red" highlight />
        </div>

        {/* Batches list */}
        <div className="bg-white rounded-2xl border overflow-hidden" data-testid="batches-list">
          <div className="px-5 py-3 border-b bg-zinc-50 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 text-sm">Verzonden batches ({batches.length})</h3>
            <span className="text-xs text-zinc-500">Klik op een rij voor details</span>
          </div>
          {loading ? (
            <div className="p-12 text-center text-zinc-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <Mail className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
              <p>Nog geen verzendingen met tracking.</p>
              <p className="text-xs mt-2">Stuur eerst een sales-mailing — daarna verschijnen de resultaten hier.</p>
            </div>
          ) : (
            <div>
              {batches.map(batch => (
                <BatchRow
                  key={batch.batch_id}
                  batch={batch}
                  expanded={expandedBatch === batch.batch_id}
                  onToggle={() => loadDetails(batch.batch_id)}
                  details={batchDetails[batch.batch_id]}
                  fmtDate={fmtDate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hoe werkt het */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1" data-testid="explainer">
          <p className="font-bold">📊 Hoe werkt open-tracking?</p>
          <p>
            Elke mail bevat een onzichtbare 1×1 pixel (transparante GIF). Wanneer de ontvanger de mail opent en
            afbeeldingen toestaat, laadt deze pixel automatisch via onze server. Dat moment registreren we als "geopend".
          </p>
          <p>
            ⚠️ <strong>Let op:</strong> Open rates zijn een indicatie, geen exacte wetenschap. Sommige mailclients
            blokkeren afbeeldingen standaard (open lager dan werkelijk), en sommige proxy-services (Apple Mail Privacy
            Protection) openen ze automatisch (open hoger dan werkelijk).
          </p>
        </div>
      </div>
    </Layout>
  );
}

function StatTile({ icon: Icon, label, value, color, highlight }) {
  const colors = {
    zinc: 'bg-zinc-50 border-zinc-200 text-zinc-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red: 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300 text-red-900',
  };
  return (
    <div className={`${colors[color]} border rounded-2xl p-4 ${highlight ? 'shadow-sm' : ''}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold opacity-70">
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <p className={`mt-1 font-black ${highlight ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

function BatchRow({ batch, expanded, onToggle, details, fmtDate }) {
  const openRateBadgeClass =
    batch.open_rate >= 30 ? 'bg-emerald-100 text-emerald-700' :
    batch.open_rate >= 15 ? 'bg-amber-100 text-amber-700' :
    'bg-zinc-100 text-zinc-600';

  return (
    <div className="border-b last:border-b-0" data-testid={`batch-${batch.batch_id}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/50 text-left transition"
        data-testid={`toggle-${batch.batch_id}`}
      >
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition ${expanded ? 'rotate-180' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{batch.subject || '(geen onderwerp)'}</p>
          <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3" />{fmtDate(batch.sent_at)}
            <span className="text-zinc-300">·</span>
            ID: <code className="text-[10px] bg-zinc-100 px-1 rounded">{batch.batch_id}</code>
          </p>
        </div>
        <div className="text-right flex items-center gap-4 flex-shrink-0">
          <div className="text-xs">
            <span className="text-zinc-400">Verstuurd</span>
            <p className="font-bold text-zinc-900 text-base">{batch.total_sent}</p>
          </div>
          <div className="text-xs">
            <span className="text-zinc-400">Geopend</span>
            <p className="font-bold text-emerald-700 text-base">{batch.total_opened}</p>
          </div>
          <div className={`${openRateBadgeClass} font-bold text-sm px-3 py-1 rounded-full min-w-[60px] text-center`}>
            {batch.open_rate}%
          </div>
        </div>
      </button>

      {expanded && (
        <div className="bg-zinc-50/50 border-t" data-testid={`details-${batch.batch_id}`}>
          {!details ? (
            <div className="p-6 text-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100/70 border-b text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="text-left px-4 py-2">Ontvanger</th>
                    <th className="text-left px-4 py-2">Bedrijf</th>
                    <th className="text-left px-4 py-2">Plaats</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Geopend</th>
                    <th className="text-left px-4 py-2 text-center">×</th>
                  </tr>
                </thead>
                <tbody>
                  {details.rows.map(row => (
                    <tr key={row.tracking_id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 text-zinc-700">{row.lead_email}</td>
                      <td className="px-4 py-2 font-medium text-zinc-900">{row.lead_name || '-'}</td>
                      <td className="px-4 py-2 text-zinc-600">{row.lead_city || '-'}</td>
                      <td className="px-4 py-2">
                        {row.opened_at ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />Geopend
                          </span>
                        ) : (
                          <span className="bg-zinc-100 text-zinc-500 text-[11px] font-bold px-2 py-0.5 rounded-full">
                            Niet geopend
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 text-xs">{fmtDate(row.opened_at)}</td>
                      <td className="px-4 py-2 text-center text-zinc-500">{row.open_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
