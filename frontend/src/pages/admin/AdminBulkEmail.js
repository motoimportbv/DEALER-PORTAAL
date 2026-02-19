import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { Mail, Send, FileText, Check, X, Loader2, Upload, Paperclip, Info, File, Trash2, Globe } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// E-mail sjablonen in 4 talen
const EMAIL_TEMPLATES = {
  de: {
    flag: '🇩🇪',
    name: 'Duits (Deutschland)',
    subject: 'Werden Sie Lieferant beim größten Motorrad-Portal der Niederlande - Moto Import B.V.',
    message: `Sehr geehrte Damen und Herren,

Moto Import B.V. ist die größte Motorrad-Handelsplattform der Niederlande. Wir suchen zuverlässige Lieferanten von Qualitätsmotorrädern aus ganz Europa.

Wer sind wir?
Moto Import B.V. ist ein etablierter Name im niederländischen Motorradhandel mit über 15 Jahren Erfahrung. Unsere Online-Plattform verbindet Hunderte von Händlern in den Benelux-Ländern mit Lieferanten aus ganz Europa.

Wie arbeiten wir?
1. Sie melden Ihre Motorräder über unsere Plattform an
2. Wir präsentieren Ihr Angebot unserem Netzwerk von 500+ aktiven Händlern
3. Bei Verkauf organisieren wir Transport und Zahlung
4. Sie erhalten eine schnelle und zuverlässige Auszahlung

Warum Moto Import wählen?
✓ Direkter Zugang zu 500+ niederländischen Händlern
✓ Schneller Verkauf - durchschnittlich innerhalb von 2 Wochen
✓ Professionelle Fotografie und Präsentation
✓ Sichere und schnelle Zahlungen
✓ Mehrsprachiger Support (NL/DE/FR/IT)
✓ Keine versteckten Kosten

Interesse?
Kontaktieren Sie uns für ein unverbindliches Gespräch über die Möglichkeiten.

Mit freundlichen Grüßen,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660
🌐 www.motoimportbv.nl

Horsterhoekweg 11
7433 SV Schalkhaar, Niederlande`
  },
  fr: {
    flag: '🇫🇷',
    name: 'Frans (France)',
    subject: 'Devenez fournisseur du plus grand portail moto des Pays-Bas - Moto Import B.V.',
    message: `Madame, Monsieur,

Moto Import B.V. est la plus grande plateforme de commerce de motos des Pays-Bas. Nous recherchons des fournisseurs fiables de motos de qualité provenant de toute l'Europe.

Qui sommes-nous?
Moto Import B.V. est un nom établi dans le commerce de motos néerlandais avec plus de 15 ans d'expérience. Notre plateforme en ligne connecte des centaines de revendeurs au Benelux avec des fournisseurs de toute l'Europe.

Comment travaillons-nous?
1. Vous enregistrez vos motos via notre plateforme
2. Nous présentons votre offre à notre réseau de 500+ revendeurs actifs
3. En cas de vente, nous organisons le transport et le paiement
4. Vous recevez un paiement rapide et fiable

Pourquoi choisir Moto Import?
✓ Accès direct à 500+ revendeurs néerlandais
✓ Vente rapide - en moyenne sous 2 semaines
✓ Photographie et présentation professionnelles
✓ Paiements sécurisés et rapides
✓ Support multilingue (NL/DE/FR/IT)
✓ Pas de frais cachés

Intéressé?
Contactez-nous pour une discussion sans engagement sur les possibilités.

Cordialement,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660
🌐 www.motoimportbv.nl

Horsterhoekweg 11
7433 SV Schalkhaar, Pays-Bas`
  },
  it: {
    flag: '🇮🇹',
    name: 'Italiaans (Italia)',
    subject: 'Diventa fornitore del più grande portale moto dei Paesi Bassi - Moto Import B.V.',
    message: `Gentile Signore/Signora,

Moto Import B.V. è la più grande piattaforma di commercio moto dei Paesi Bassi. Cerchiamo fornitori affidabili di moto di qualità da tutta Europa.

Chi siamo?
Moto Import B.V. è un nome affermato nel commercio di moto olandese con oltre 15 anni di esperienza. La nostra piattaforma online collega centinaia di rivenditori nel Benelux con fornitori di tutta Europa.

Come lavoriamo?
1. Registrate le vostre moto tramite la nostra piattaforma
2. Presentiamo la vostra offerta alla nostra rete di 500+ rivenditori attivi
3. In caso di vendita, organizziamo trasporto e pagamento
4. Ricevete un pagamento rapido e affidabile

Perché scegliere Moto Import?
✓ Accesso diretto a 500+ rivenditori olandesi
✓ Vendita rapida - in media entro 2 settimane
✓ Fotografia e presentazione professionali
✓ Pagamenti sicuri e rapidi
✓ Supporto multilingue (NL/DE/FR/IT)
✓ Nessun costo nascosto

Interessato?
Contattateci per una discussione senza impegno sulle possibilità.

Cordiali saluti,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660
🌐 www.motoimportbv.nl

Horsterhoekweg 11
7433 SV Schalkhaar, Paesi Bassi`
  },
  nl: {
    flag: '🇳🇱',
    name: 'Nederlands',
    subject: 'Word leverancier bij het grootste motorfiets portaal van Nederland - Moto Import B.V.',
    message: `Geachte heer/mevrouw,

Moto Import B.V. is het grootste motorfiets handelsplatform van Nederland. Wij zijn op zoek naar betrouwbare leveranciers van kwaliteitsmotoren uit heel Europa.

Wie zijn wij?
Moto Import B.V. is een gevestigde naam in de Nederlandse motorhandel met meer dan 15 jaar ervaring. Ons online platform verbindt honderden dealers in de Benelux met leveranciers uit heel Europa.

Hoe werken wij?
1. U meldt uw motorfietsen aan via ons platform
2. Wij presenteren uw aanbod aan ons netwerk van 500+ actieve dealers
3. Bij verkoop regelen wij het transport en de betaling
4. U ontvangt een snelle en betrouwbare uitbetaling

Waarom kiezen voor Moto Import?
✓ Direct toegang tot 500+ Nederlandse dealers
✓ Snelle verkoop - gemiddeld binnen 2 weken
✓ Professionele fotografie en presentatie
✓ Veilige en snelle betalingen
✓ Meertalige ondersteuning (NL/DE/FR/IT)
✓ Geen verborgen kosten

Interesse?
Neem contact met ons op voor een vrijblijvend gesprek over de mogelijkheden.

Met vriendelijke groet,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660
🌐 www.motoimportbv.nl

Horsterhoekweg 11
7433 SV Schalkhaar, Nederland`
  }
};

export default function AdminBulkEmail() {
  const [lists, setLists] = useState([]);
  const [flyers, setFlyers] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState('');
  const [includeAboutUs, setIncludeAboutUs] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');

  const applyTemplate = (langCode) => {
    if (langCode && EMAIL_TEMPLATES[langCode]) {
      const template = EMAIL_TEMPLATES[langCode];
      setSubject(template.subject);
      setMessage(template.message);
      setSelectedLanguage(langCode);
      toast.success(`${template.flag} ${template.name} sjabloon geladen`);
    } else {
      setSelectedLanguage('');
    }
  };

  useEffect(() => {
    fetchLists();
    fetchFlyers();
  }, []);

  const fetchLists = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/marketing-lists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLists(response.data);
    } catch (error) {
      toast.error('Fout bij ophalen lijsten');
    }
  };

  const fetchFlyers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/available-flyers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFlyers(response.data);
    } catch (error) {
      console.error('Error fetching flyers:', error);
    }
  };

  const loadList = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/marketing-list/${filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmails(response.data);
      setSelectedEmails(response.data.map(e => e.email));
      setSelectedList(filename);
    } catch (error) {
      toast.error('Fout bij laden lijst');
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Alleen CSV bestanden toegestaan');
      return;
    }

    setUploadingCSV(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/admin/upload-marketing-csv`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(response.data.message);
      await fetchLists();
      
      setEmails(response.data.emails);
      setSelectedEmails(response.data.emails.map(e => e.email));
      setSelectedList(response.data.filename);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij uploaden CSV');
    } finally {
      setUploadingCSV(false);
      e.target.value = '';
    }
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Alleen PDF bestanden toegestaan');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Bestand te groot (max 5MB)');
      return;
    }

    setUploadingPDF(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/admin/upload-flyer`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(response.data.message);
      await fetchFlyers();
      setSelectedFlyer(response.data.filename);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij uploaden PDF');
    } finally {
      setUploadingPDF(false);
      e.target.value = '';
    }
  };

  const toggleEmail = (email) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const selectAll = () => setSelectedEmails(emails.map(e => e.email));
  const deselectAll = () => setSelectedEmails([]);

  const sendEmails = async () => {
    if (!subject.trim()) {
      toast.error('Vul een onderwerp in');
      return;
    }
    if (!message.trim()) {
      toast.error('Vul een bericht in');
      return;
    }
    if (selectedEmails.length === 0) {
      toast.error('Selecteer minimaal één ontvanger');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/admin/bulk-email`, {
        subject,
        message,
        recipient_emails: selectedEmails,
        include_about_us: includeAboutUs,
        flyer_filename: selectedFlyer || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResult(response.data);
      toast.success(`${response.data.sent} van ${response.data.total} e-mails verzonden!`);
    } catch (error) {
      toast.error('Fout bij verzenden e-mails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Marketing E-mails</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linker kolom: Lijsten & Uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              E-mail Lijsten & Bestanden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CSV Upload */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">📋 CSV met Email Adressen</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => document.getElementById('csv-upload').click()}>
                <input
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={uploadingCSV}
                />
                {uploadingCSV ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploaden...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Klik hier om CSV te uploaden</span>
                  </div>
                )}
              </div>
            </div>

            {/* PDF Upload */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">📄 PDF Flyer Uploaden</p>
              <div className="border-2 border-dashed border-orange-300 rounded-lg p-3 text-center hover:border-orange-400 transition-colors bg-orange-50 cursor-pointer" onClick={() => document.getElementById('pdf-upload').click()}>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePDFUpload}
                  className="hidden"
                  id="pdf-upload"
                  disabled={uploadingPDF}
                />
                {uploadingPDF ? (
                  <div className="flex items-center justify-center gap-2 text-orange-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploaden...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <File className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-orange-700">Klik hier om PDF te uploaden (max 5MB)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Beschikbare Lijsten */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Beschikbare Lijsten:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lists.map((list) => (
                  <button
                    key={list.filename}
                    onClick={() => loadList(list.filename)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors text-sm ${
                      selectedList === list.filename
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="font-medium truncate">
                      {list.display_name || list.filename.replace('.csv', '')}
                    </div>
                    <div className="text-xs text-gray-500">{list.count} emails</div>
                  </button>
                ))}
                {lists.length === 0 && (
                  <p className="text-gray-500 text-sm">Geen lijsten - upload een CSV</p>
                )}
              </div>
            </div>

            {/* Beschikbare Flyers */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Beschikbare Flyers ({flyers.length}):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {flyers.map((flyer) => (
                  <div
                    key={flyer.filename}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      selectedFlyer === flyer.filename ? 'bg-orange-100' : 'bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedFlyer(selectedFlyer === flyer.filename ? '' : flyer.filename)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <File className="h-4 w-4 text-orange-500" />
                      <span className="truncate">{flyer.filename}</span>
                    </button>
                    <span className="text-xs text-gray-500">{flyer.size_kb}KB</span>
                  </div>
                ))}
                {flyers.length === 0 && (
                  <p className="text-gray-500 text-xs">Geen flyers - upload een PDF</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rechter kolom: E-mail opstellen */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              E-mail Opstellen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Onderwerp</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Bijv: Nieuwe motoren beschikbaar bij Moto Import"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bericht</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Typ hier uw bericht..."
                rows={5}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Extra opties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="include-about-us"
                  checked={includeAboutUs}
                  onChange={(e) => setIncludeAboutUs(e.target.checked)}
                  className="mt-1 rounded"
                />
                <label htmlFor="include-about-us" className="text-sm">
                  <span className="font-medium flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    "Over Ons" sectie toevoegen
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Paperclip className="h-4 w-4" />
                  Geselecteerde flyer: 
                </label>
                {selectedFlyer ? (
                  <div className="flex items-center gap-2 p-2 bg-orange-100 rounded text-sm">
                    <File className="h-4 w-4 text-orange-600" />
                    <span className="truncate flex-1">{selectedFlyer}</span>
                    <button onClick={() => setSelectedFlyer('')} className="text-gray-500 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Geen bijlage (klik op flyer in linker kolom)</p>
                )}
              </div>
            </div>

            {/* Ontvangers */}
            {selectedList && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    Ontvangers: {selectedEmails.length} van {emails.length}
                  </span>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>Alles</Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>Niets</Button>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {emails.map((item) => (
                    <label
                      key={item.email}
                      className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(item.email)}
                        onChange={() => toggleEmail(item.email)}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">{item.name || 'Onbekend'}</span>
                      <span className="text-xs text-gray-500 truncate">{item.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={sendEmails}
              disabled={sending || selectedEmails.length === 0}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Verstuur naar {selectedEmails.length} ontvangers
                  {selectedFlyer && ' (+ bijlage)'}
                </>
              )}
            </Button>

            {result && (
              <div className={`p-4 rounded-lg ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2">
                  {result.failed === 0 ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className="font-medium">
                    {result.sent} van {result.total} e-mails verzonden
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
