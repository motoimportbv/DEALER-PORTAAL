import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, FileText, Mail, Eye, FileCode, Type } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUBJECT = "BPM-taxatieverslag voor uw motorzaak — €60 intro + binnen 48u in uw mailbox";

const PLAIN_TEXT = `Beste collega,

Geen gedoe meer met BPM-papierwerk.

Wij zijn Moto Import B.V. — gespecialiseerd in officiële BPM-taxatieverslagen voor motorfietsen. Belastingdienst-proof, scherp geprijsd, snel geleverd.

WAAROM ANDERE MOTORZAKEN VOOR ONS KIEZEN:
• 100% gespecialiseerd in motoren — geen auto's, geen omwegen
• Belastingdienst-proof rapporten volgens RDW-richtlijnen
• Binnen 48 uur het verslag + BPM-berekening in uw mailbox
• Eigen dealer-dashboard waar u alle aanvragen + status terugziet
• Direct toegang — geen wachten op goedkeuring

ONZE TARIEVEN:
• Introductietarief: €60 ex BTW voor uw eerste taxatieverslag
• Daarna vaste prijs: €120 ex BTW per verslag
• Verzendkosten en uitprinten: €20 ex BTW (totaal)
• Geen abonnement, geen verrassingen

ZO WERKT HET:
1. Maak een gratis dealer-account aan op motoimportbv.nl/taxatie-dealer/register
2. Upload de 9 vereiste foto's + voertuiggegevens
3. Wij sturen u binnen 48 uur het officiële taxatieverslag

PROBEER HET RISICOLOOS:
Profiteer nu van het introductietarief van €60 ex BTW.
> Account aanmaken: https://www.motoimportbv.nl/taxatie-dealer/register

LIEVER EERST EVEN BELLEN?
Sandro is direct bereikbaar op:
> Tel: 06-24264861
> WhatsApp: 06-24264861
> Mail: motoimportbv@gmail.com

Zie de bijgevoegde flyer voor alle details.

Met vriendelijke groet,

Sandro
Moto Import B.V.
Horsterhoekweg 11, 7433 SV Schalkhaar
KVK 94622086
www.motoimportbv.nl
`;

const HTML_BODY = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; color: #18181b;">

  <!-- Hero -->
  <div style="background: linear-gradient(135deg, #18181b 0%, #7f1d1d 100%); color: white; padding: 36px 28px;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #fca5a5; text-transform: uppercase;">Voor motorzaken in Nederland</p>
    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; line-height: 1.1;">Geen gedoe meer met BPM-papierwerk.</h1>
    <p style="margin: 0; color: #fecaca; font-size: 15px;">Officieel BPM-taxatieverslag — binnen 48 uur in uw mailbox.</p>
  </div>

  <!-- Body -->
  <div style="background: white; padding: 28px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Beste collega,</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Wij zijn <strong>Moto Import B.V.</strong> — 100% gespecialiseerd in officiële BPM-taxatieverslagen voor motorfietsen. Belastingdienst-proof, scherp geprijsd, snel geleverd.
    </p>

    <!-- Aanbieding box -->
    <div style="margin: 24px 0; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px;">
      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 1px;">Introductietarief</p>
      <p style="margin: 0; font-size: 32px; font-weight: 900; color: #18181b; line-height: 1;">€60 <span style="font-size: 14px; color: #71717a; font-weight: 600;">ex BTW · eerste taxatie</span></p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #525252;">Daarna vaste prijs: €120 ex BTW · verzendkosten + uitprinten €20 ex BTW</p>
    </div>

    <!-- USPs -->
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Waarom motorzaken voor ons kiezen</h3>
    <ul style="margin: 0 0 24px; padding-left: 18px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
      <li>100% gespecialiseerd in motoren — geen auto's, geen omwegen</li>
      <li>Belastingdienst-proof rapporten volgens RDW-richtlijnen</li>
      <li>Binnen 48 uur het verslag + BPM-berekening in uw mailbox</li>
      <li>Eigen dealer-dashboard — al uw aanvragen + status op één plek</li>
      <li>Direct toegang na registratie, geen wachten op goedkeuring</li>
    </ul>

    <!-- Stappen -->
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Zo werkt het in 3 stappen</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
      <tr>
        <td style="vertical-align: top; width: 30%; padding: 8px 12px 8px 0;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">01</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">Aanmelden</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">Gratis dealer-account aanmaken</p>
        </td>
        <td style="vertical-align: top; width: 30%; padding: 8px 12px;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">02</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">Upload foto's</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">9 foto's + voertuiggegevens via formulier</p>
        </td>
        <td style="vertical-align: top; width: 30%; padding: 8px 0 8px 12px;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">03</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">PDF in mailbox</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">Binnen 48 uur ondertekend verslag</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="https://www.motoimportbv.nl/taxatie-dealer/register" style="display: inline-block; background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Gratis account aanmaken →
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">geen creditcard nodig · direct toegang</p>
    </div>

    <!-- Contact -->
    <div style="margin: 32px 0 0; padding: 18px; background: #18181b; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #fafafa;">Liever eerst even bellen of WhatsAppen?</p>
      <p style="margin: 0; font-size: 16px; font-weight: 700;">
        <a href="tel:+31624264861" style="color: #fca5a5; text-decoration: none; margin: 0 12px;">📞 06-24264861</a>
        <a href="https://wa.me/31624264861" style="color: #fca5a5; text-decoration: none; margin: 0 12px;">💬 WhatsApp</a>
      </p>
    </div>

    <p style="margin: 28px 0 4px; font-size: 13px; color: #525252;">
      📎 Zie de bijgevoegde flyer voor alle details.
    </p>
  </div>

  <!-- Signature -->
  <div style="background: white; padding: 16px 28px 28px; font-size: 13px; color: #3f3f46;">
    <p style="margin: 16px 0 4px;">Met vriendelijke groet,</p>
    <p style="margin: 0 0 4px; font-weight: 700; color: #18181b;">Sandro</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">Moto Import B.V. · Horsterhoekweg 11, 7433 SV Schalkhaar</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">KVK 94622086 · <a href="https://www.motoimportbv.nl" style="color: #dc2626;">www.motoimportbv.nl</a></p>
  </div>
</div>`;

export default function TaxatieSalesMail() {
  const { user } = useAuth();
  const [view, setView] = useState('preview');  // 'preview' | 'html' | 'plain'
  const [copied, setCopied] = useState('');

  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  const copyTo = (label, content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(label);
      toast.success(`${label} gekopieerd naar klembord`);
      setTimeout(() => setCopied(''), 2500);
    }).catch(() => toast.error('Kopiëren mislukt'));
  };

  const downloadFlyer = () => window.open(`${API}/public/taxatie-flyer`, '_blank');

  if (!isAllowed) {
    return <Layout><div className="p-10 text-center text-zinc-500">Geen toegang</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="sales-mail-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Mail className="w-7 h-7 text-red-600" /> Sales-mail naar motorzaken
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Kant-en-klare e-mail om dealers binnen te halen — kopiëer naar Gmail/Outlook of stuur in bulk.</p>
          </div>
          <Link to="/admin/taxatie-aanvragen">
            <Button variant="outline" data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />Terug
            </Button>
          </Link>
        </div>

        {/* Onderwerp regel + acties */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" data-testid="subject-block">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Onderwerp</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly value={SUBJECT}
                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm font-bold bg-zinc-50"
                data-testid="subject-input"
              />
              <Button onClick={() => copyTo('Onderwerp', SUBJECT)} variant="outline" size="sm" data-testid="copy-subject-btn">
                {copied === 'Onderwerp' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t flex-wrap">
            <Button onClick={downloadFlyer} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="download-flyer-btn">
              <FileText className="w-4 h-4 mr-2" />Download flyer (bijlage)
            </Button>
            <Button onClick={() => copyTo('HTML body', HTML_BODY)} variant="outline" data-testid="copy-html-btn">
              {copied === 'HTML body' ? <Check className="w-4 h-4 text-emerald-600 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Kopieer HTML
            </Button>
            <Button onClick={() => copyTo('Plain-text', PLAIN_TEXT)} variant="outline" data-testid="copy-plain-btn">
              {copied === 'Plain-text' ? <Check className="w-4 h-4 text-emerald-600 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Kopieer plain-text
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <TabBtn active={view === 'preview'} onClick={() => setView('preview')} icon={Eye} label="Visuele preview" testid="tab-preview" />
          <TabBtn active={view === 'html'} onClick={() => setView('html')} icon={FileCode} label="HTML code" testid="tab-html" />
          <TabBtn active={view === 'plain'} onClick={() => setView('plain')} icon={Type} label="Plain-text" testid="tab-plain" />
        </div>

        {/* Content */}
        {view === 'preview' && (
          <div className="bg-zinc-100 rounded-2xl p-4 sm:p-8 border" data-testid="preview-block">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mx-auto" style={{ maxWidth: '640px' }} dangerouslySetInnerHTML={{ __html: HTML_BODY }} />
          </div>
        )}
        {view === 'html' && (
          <textarea
            readOnly value={HTML_BODY}
            className="w-full h-[560px] border border-zinc-300 rounded-2xl px-4 py-3 text-xs font-mono bg-zinc-50 focus:outline-none"
            data-testid="html-textarea"
          />
        )}
        {view === 'plain' && (
          <textarea
            readOnly value={PLAIN_TEXT}
            className="w-full h-[560px] border border-zinc-300 rounded-2xl px-4 py-3 text-sm font-mono bg-zinc-50 focus:outline-none whitespace-pre"
            data-testid="plain-textarea"
          />
        )}

        {/* Instructies */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm" data-testid="instructions-block">
          <h3 className="font-bold text-blue-900 mb-2">📋 Verzendinstructies</h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-blue-900">
            <li><strong>Download de flyer</strong> (knop hierboven) als PDF-bijlage.</li>
            <li>Open Gmail / Outlook → nieuwe e-mail.</li>
            <li>Plak de onderwerp-regel.</li>
            <li>Klik op "HTML-bewerker aanzetten" (Gmail: het kleine pijltje &gt; "Layout" / Outlook: knop met &lt;/&gt;) en plak de HTML-body.</li>
            <li>Plaats motorzaken in <strong>BCC</strong> (niet CC!) zodat ze elkaars e-mailadres niet zien — GDPR-veilig.</li>
            <li>Voeg de flyer-PDF als bijlage toe.</li>
            <li>Verzenden!</li>
          </ol>
          <p className="text-xs text-blue-700 mt-3">💡 Tip: stuur niet meer dan 50 mailtjes tegelijk om in spam-filters te voorkomen. Spreid bv. 50 per dag over een week.</p>
        </div>
      </div>
    </Layout>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px flex items-center gap-2 transition-colors ${
        active ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-500 hover:text-zinc-900'
      }`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}
