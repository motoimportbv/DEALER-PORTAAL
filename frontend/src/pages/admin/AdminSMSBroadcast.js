import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { MessageSquare, Send, Phone, Loader2, Check, X, Bike, Users, CheckSquare, Square } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminSMSBroadcast() {
  const [motorcycles, setMotorcycles] = useState([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [allDealers, setAllDealers] = useState([]);
  const [selectedDealers, setSelectedDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [activeTab, setActiveTab] = useState('motor'); // 'motor' or 'custom'

  useEffect(() => {
    fetchMotorcycles();
    fetchSMSStatus();
    fetchAllDealers();
  }, []);

  const fetchMotorcycles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motorcycles/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotorcycles(response.data);
    } catch (error) {
      console.error('Error fetching motorcycles:', error);
    }
  };

  const fetchSMSStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/sms/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSmsStatus(response.data);
    } catch (error) {
      console.error('Error fetching SMS status:', error);
    }
  };

  const fetchAllDealers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/dealers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only Dutch dealers with phone numbers
      const dealersWithPhone = response.data.filter(d => 
        d.phone && 
        d.phone.trim() !== '' && 
        !d.is_foreign_dealer &&
        d.is_approved
      );
      setAllDealers(dealersWithPhone);
      // Select all by default
      setSelectedDealers(dealersWithPhone.map(d => d.id));
    } catch (error) {
      console.error('Error fetching dealers:', error);
    }
  };

  const selectMotorcycle = async (moto) => {
    setSelectedMotorcycle(moto);
  };

  const toggleDealer = (dealerId) => {
    if (selectedDealers.includes(dealerId)) {
      setSelectedDealers(selectedDealers.filter(id => id !== dealerId));
    } else {
      setSelectedDealers([...selectedDealers, dealerId]);
    }
  };

  const selectAllDealers = () => {
    setSelectedDealers(allDealers.map(d => d.id));
  };

  const deselectAllDealers = () => {
    setSelectedDealers([]);
  };

  const sendSMSToSelected = async () => {
    if (selectedDealers.length === 0) {
      toast.error('Selecteer minimaal één dealer');
      return;
    }

    if (activeTab === 'motor' && !selectedMotorcycle) {
      toast.error('Selecteer eerst een motor');
      return;
    }

    if (activeTab === 'custom' && !customMessage.trim()) {
      toast.error('Voer een bericht in');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get selected dealer phone numbers
      const selectedDealerData = allDealers.filter(d => selectedDealers.includes(d.id));
      
      let message = '';
      if (activeTab === 'motor' && selectedMotorcycle) {
        message = `🏍️ NIEUWE MOTOR bij Moto Import!\n\n${selectedMotorcycle.brand} ${selectedMotorcycle.model} (${selectedMotorcycle.year})\n💰 €${selectedMotorcycle.price?.toLocaleString()}\n📍 ${selectedMotorcycle.mileage?.toLocaleString()} km\n\nBekijk: https://www.motoimportbv.nl/motorcycle/${selectedMotorcycle.id}`;
      } else {
        message = customMessage;
      }

      const response = await axios.post(
        `${API}/api/sms/send-to-selected`,
        { 
          message,
          dealer_ids: selectedDealers
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`SMS verzonden naar ${response.data.sent} van ${response.data.total} dealers!`);
      if (response.data.failed > 0) {
        toast.warning(`${response.data.failed} SMS mislukt (mogelijk niet-geverifieerd nummer)`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij verzenden SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">SMS Broadcast</h1>
            <p className="text-gray-500">Kies welke 🇳🇱 Nederlandse dealers een SMS krijgen</p>
          </div>
        </div>

        {/* SMS Status & Twilio Warning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {smsStatus && (
            <Card className={smsStatus.configured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  {smsStatus.configured ? (
                    <>
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="text-green-800">
                        SMS actief • {allDealers.length} dealers met telefoon
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 text-red-600" />
                      <span className="text-red-800">SMS niet geconfigureerd</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-amber-600" />
                <span className="text-amber-800 text-sm">
                  ⚠️ Twilio Trial: Alleen geverifieerde nummers ontvangen SMS
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dealer Selectie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Dealers Selecteren
                </span>
                <span className="text-sm font-normal text-gray-500">
                  {selectedDealers.length}/{allDealers.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllDealers} className="flex-1">
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Alles
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllDealers} className="flex-1">
                  <Square className="h-4 w-4 mr-1" />
                  Niets
                </Button>
              </div>
              
              <div className="max-h-80 overflow-y-auto space-y-1 border rounded-lg p-2">
                {allDealers.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Geen dealers met telefoonnummer
                  </p>
                ) : (
                  allDealers.map((dealer) => (
                    <label
                      key={dealer.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        selectedDealers.includes(dealer.id) 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDealers.includes(dealer.id)}
                        onChange={() => toggleDealer(dealer.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{dealer.company_name}</p>
                        <p className="text-xs text-gray-500">{dealer.phone}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bericht Opstellen */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                SMS Bericht
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tab knoppen */}
              <div className="flex gap-2 border-b pb-3">
                <Button 
                  variant={activeTab === 'motor' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('motor')}
                  className="flex-1"
                >
                  <Bike className="h-4 w-4 mr-2" />
                  Motor Delen
                </Button>
                <Button 
                  variant={activeTab === 'custom' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('custom')}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Eigen Bericht
                </Button>
              </div>

              {activeTab === 'motor' ? (
                <>
                  <p className="text-sm text-gray-500">
                    Selecteer een motor om te delen via SMS
                  </p>
                  
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {motorcycles.map((moto) => (
                      <button
                        key={moto.id}
                        onClick={() => selectMotorcycle(moto)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedMotorcycle?.id === moto.id
                            ? 'bg-blue-50 border-blue-500'
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="font-medium">{moto.brand} {moto.model}</div>
                        <div className="text-sm text-gray-500">
                          {moto.year} • €{moto.price?.toLocaleString()} • {moto.mileage?.toLocaleString()} km
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedMotorcycle && (
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <p className="text-sm font-medium text-gray-700 mb-2">Preview SMS:</p>
                      <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">
{`🏍️ NIEUWE MOTOR bij Moto Import!

${selectedMotorcycle.brand} ${selectedMotorcycle.model} (${selectedMotorcycle.year})
💰 €${selectedMotorcycle.price?.toLocaleString()}
📍 ${selectedMotorcycle.mileage?.toLocaleString()} km

Bekijk: motoimportbv.nl/...`}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500">
                    Typ een eigen bericht om te versturen
                  </p>
                  
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Typ hier uw bericht..."
                    className="w-full p-3 border rounded-lg h-40 resize-none"
                    maxLength={320}
                  />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{customMessage.length} / 320 tekens</span>
                    <span>{Math.ceil(customMessage.length / 160) || 1} SMS per dealer</span>
                  </div>
                </>
              )}

              {/* Verstuur knop */}
              <Button 
                onClick={sendSMSToSelected}
                disabled={sending || selectedDealers.length === 0 || (activeTab === 'motor' && !selectedMotorcycle) || (activeTab === 'custom' && !customMessage.trim())}
                className="w-full bg-blue-600 hover:bg-blue-700"
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
                    SMS naar {selectedDealers.length} Dealer{selectedDealers.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
