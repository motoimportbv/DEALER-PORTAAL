import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { Mail, Send, FileText, Check, X, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminBulkEmail() {
  const { t } = useTranslation();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchLists();
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
        recipient_emails: selectedEmails
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
              Beschikbare Lijsten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
                  {list.filename.replace('Motorzaken_', '').replace('.csv', '')}
                </div>
                <div className="text-xs text-gray-500">{list.count} dealers</div>
              </button>
            ))}
            {lists.length === 0 && (
              <p className="text-gray-500 text-sm">Geen lijsten beschikbaar</p>
            )}
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
                rows={8}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
                      <span className="text-sm flex-1">{item.name}</span>
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
