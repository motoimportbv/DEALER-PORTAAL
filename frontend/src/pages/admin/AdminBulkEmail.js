import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { Mail, Send, FileText, Check, X, Loader2, Upload, Paperclip, Info, File, Trash2, Globe } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// E-mail sjablonen in 4 talen - Kort & Zakelijk B2B met vertrouwen
const EMAIL_TEMPLATES = {
  de: {
    flag: '🇩🇪',
    name: 'Duits (Deutschland)',
    subject: 'Partnerschaf mit Moto Import - Verkaufen Sie direkt an Benelux-Händler',
    message: `Sehr geehrte Damen und Herren,

Wir sind Moto Import B.V. aus den Niederlanden – ein zuverlässiger Partner für Motorradhändler in der gesamten Benelux-Region.

Unser Angebot ist einfach:
→ Sie stellen Ihre Motorräder mit Einkaufspreisen auf unsere Plattform
→ Wir präsentieren sie unserem Netzwerk von professionellen Motorradhändlern
→ Sie erhalten automatisch eine E-Mail, sobald Ihr Motorrad verkauft ist

Schnell, transparent und ohne versteckte Kosten.

Interesse? Antworten Sie einfach auf diese E-Mail – wir helfen Ihnen gerne weiter.

Mit freundlichen Grüßen,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660`
  },
  fr: {
    flag: '🇫🇷',
    name: 'Frans (France)',
    subject: 'Partenariat avec Moto Import - Vendez directement aux revendeurs du Benelux',
    message: `Madame, Monsieur,

Nous sommes Moto Import B.V. des Pays-Bas – un partenaire fiable pour les professionnels de la moto dans tout le Benelux.

Notre proposition est simple :
→ Vous placez vos motos sur notre plateforme avec vos prix d'achat
→ Nous les présentons à notre réseau de revendeurs professionnels
→ Vous recevez automatiquement un e-mail dès que votre moto est vendue

Rapide, transparent et sans frais cachés.

Intéressé ? Répondez simplement à cet e-mail – nous serons ravis de vous accompagner.

Cordialement,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660`
  },
  it: {
    flag: '🇮🇹',
    name: 'Italiaans (Italia)',
    subject: 'Partnership con Moto Import - Vendete direttamente ai rivenditori del Benelux',
    message: `Gentile Signore/Signora,

Siamo Moto Import B.V. dai Paesi Bassi – un partner affidabile per i professionisti delle moto in tutto il Benelux.

La nostra proposta è semplice:
→ Inserite le vostre moto sulla nostra piattaforma con i vostri prezzi di acquisto
→ Le presentiamo alla nostra rete di rivenditori professionali
→ Ricevete automaticamente un'e-mail quando la vostra moto viene venduta

Veloce, trasparente e senza costi nascosti.

Interessati? Rispondete semplicemente a questa e-mail – saremo lieti di assistervi.

Cordiali saluti,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660`
  },
  nl: {
    flag: '🇳🇱',
    name: 'Nederlands',
    subject: 'Samenwerking met Moto Import - Verkoop direct aan Benelux dealers',
    message: `Geachte heer/mevrouw,

Wij zijn Moto Import B.V. – een betrouwbare partner voor motorzaken in de Benelux.

Ons aanbod is eenvoudig:
→ U plaatst uw motoren op ons platform met uw inkoopprijzen
→ Wij presenteren ze aan ons netwerk van professionele motordealers
→ U ontvangt automatisch een e-mail zodra uw motor verkocht is

Snel, transparant en zonder verborgen kosten.

Interesse? Reageer gerust op deze e-mail – wij helpen u graag verder.

Met vriendelijke groet,

Moto Import B.V.
📧 motoimportbv@gmail.com
📞 +31 6 81792660`
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
            {/* Taal Sjabloon Selector */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold mb-3 flex items-center gap-2 text-blue-800">
                <Globe className="h-5 w-5" />
                Kies Taal Sjabloon (1-klik invullen)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(EMAIL_TEMPLATES).map(([code, template]) => (
                  <button
                    key={code}
                    onClick={() => applyTemplate(code)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all font-medium ${
                      selectedLanguage === code
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                        : 'bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-400 text-gray-700'
                    }`}
                  >
                    <span className="text-xl">{template.flag}</span>
                    <span className="text-sm hidden sm:inline">{code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
              {selectedLanguage && (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {EMAIL_TEMPLATES[selectedLanguage].name} sjabloon actief
                </p>
              )}
            </div>

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
