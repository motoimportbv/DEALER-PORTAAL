import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { Mail, Send, FileText, Check, X, Loader2, Upload, Paperclip, Info } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

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
  const [uploading, setUploading] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState('');
  const [includeAboutUs, setIncludeAboutUs] = useState(false);

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Alleen CSV bestanden toegestaan');
      return;
    }

    setUploading(true);
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
      
      // Refresh lists and load the new one
      await fetchLists();
      
      // Set the uploaded emails directly
      setEmails(response.data.emails);
      setSelectedEmails(response.data.emails.map(e => e.email));
      setSelectedList(response.data.filename);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij uploaden');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const toggleEmail = (email) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const selectAll = () => {
    setSelectedEmails(emails.map(e => e.email));
  };

  const deselectAll = () => {
    setSelectedEmails([]);
  };

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
        {/* Lijsten selectie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              E-mail Lijsten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CSV Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={uploading}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploaden...
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Upload CSV bestand
                    </span>
                    <span className="text-xs text-gray-400">
                      (met kolom: Email)
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Beschikbare Lijsten:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lists.map((list) => (
                  <button
                    key={list.filename}
                    onClick={() => loadList(list.filename)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedList === list.filename
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {list.display_name || list.filename.replace('Motorzaken_', '').replace('.csv', '')}
                    </div>
                    <div className="text-xs text-gray-500">{list.count} dealers</div>
                  </button>
                ))}
                {lists.length === 0 && (
                  <p className="text-gray-500 text-sm">Geen lijsten beschikbaar</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* E-mail compositie */}
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
                rows={6}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Extra opties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* About Us checkbox */}
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
                  <span className="text-gray-500 block text-xs">
                    Voegt bedrijfsinformatie toe aan de email
                  </span>
                </label>
              </div>

              {/* Flyer attachment */}
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Paperclip className="h-4 w-4" />
                  Flyer bijvoegen
                </label>
                <select
                  value={selectedFlyer}
                  onChange={(e) => setSelectedFlyer(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="">Geen bijlage</option>
                  {flyers.map((flyer) => (
                    <option key={flyer.filename} value={flyer.filename}>
                      {flyer.filename} ({flyer.size_kb} KB)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedList && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    Ontvangers: {selectedEmails.length} van {emails.length}
                  </span>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Alles selecteren
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Niets selecteren
                    </Button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {emails.map((item) => (
                    <label
                      key={item.email}
                      className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(item.email)}
                        onChange={() => toggleEmail(item.email)}
                        className="rounded"
                      />
                      <span className="text-sm flex-1">{item.name || 'Onbekend'}</span>
                      <span className="text-xs text-gray-500">{item.email}</span>
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
                  Verzenden... ({selectedEmails.length} e-mails)
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Verstuur naar {selectedEmails.length} ontvangers
                  {selectedFlyer && ' (met bijlage)'}
                </>
              )}
            </Button>

            {result && (
              <div className={`p-4 rounded-lg ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.failed === 0 ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className="font-medium">
                    {result.sent} van {result.total} e-mails succesvol verzonden
                  </span>
                </div>
                {result.failed > 0 && (
                  <div className="text-sm text-yellow-700">
                    Mislukt: {result.failed_emails.join(', ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
