import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { MessageSquare, Send, Phone, Loader2, Check, X, Bike } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminSMSBroadcast() {
  const [motorcycles, setMotorcycles] = useState([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    fetchMotorcycles();
    fetchSMSStatus();
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

  const fetchDealersForMotorcycle = async (motorcycleId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motorcycles/${motorcycleId}/sms-share`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDealers(response.data.dealers || []);
      setSelectedMotorcycle(response.data.motorcycle);
    } catch (error) {
      toast.error('Kon dealers niet laden');
    } finally {
      setLoading(false);
    }
  };

  const sendSMSToAll = async () => {
    if (!selectedMotorcycle) {
      toast.error('Selecteer eerst een motor');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/motorcycles/${selectedMotorcycle.id}/sms-send-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`SMS verzonden naar ${response.data.sent} dealers!`);
      if (response.data.failed > 0) {
        toast.warning(`${response.data.failed} SMS mislukt`);
      }
    } catch (error) {
      toast.error('Fout bij verzenden SMS');
    } finally {
      setSending(false);
    }
  };

  const sendCustomSMS = async () => {
    if (!customMessage.trim()) {
      toast.error('Voer een bericht in');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/sms/send-all`,
        { message: customMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`SMS verzonden naar ${response.data.sent} dealers!`);
      setCustomMessage('');
    } catch (error) {
      toast.error('Fout bij verzenden SMS');
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
            <p className="text-gray-500">Stuur SMS meldingen naar 🇳🇱 Nederlandse dealers</p>
          </div>
        </div>

        {/* SMS Status */}
        {smsStatus && (
          <Card className={smsStatus.configured ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {smsStatus.configured ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-green-800">
                      SMS is actief • {smsStatus.dealers_with_phone} dealers met telefoonnummer
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">SMS is niet geconfigureerd</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Motor selectie voor SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5" />
                SMS bij Nieuwe Motor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Selecteer een motor om alle Nederlandse dealers per SMS te informeren.
              </p>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {motorcycles.map((moto) => (
                  <button
                    key={moto.id}
                    onClick={() => fetchDealersForMotorcycle(moto.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedMotorcycle?.id === moto.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="font-medium">{moto.brand} {moto.model}</div>
                    <div className="text-sm text-gray-500">
                      {moto.year} • €{moto.price?.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>

              {selectedMotorcycle && (
                <div className="border-t pt-4">
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <p className="font-medium text-blue-900">
                      {selectedMotorcycle.brand} {selectedMotorcycle.model}
                    </p>
                    <p className="text-sm text-blue-700">
                      {dealers.length} dealers met telefoonnummer
                    </p>
                  </div>
                  
                  <Button 
                    onClick={sendSMSToAll}
                    disabled={sending || dealers.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verzenden...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        SMS naar {dealers.length} Dealers
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Eigen Bericht Sturen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Stuur een aangepast SMS bericht naar alle Nederlandse dealers.
              </p>
              
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Typ hier uw bericht... (max 160 tekens voor 1 SMS)"
                className="w-full p-3 border rounded-lg h-32 resize-none"
                maxLength={320}
              />
              
              <div className="flex justify-between text-sm text-gray-500">
                <span>{customMessage.length} / 320 tekens</span>
                <span>{Math.ceil(customMessage.length / 160)} SMS</span>
              </div>

              <Button 
                onClick={sendCustomSMS}
                disabled={sending || !customMessage.trim()}
                className="w-full"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verzenden...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Verstuur SMS
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Dealers met telefoonnummer */}
        {dealers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dealers ({dealers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dealers.map((dealer) => (
                  <div key={dealer.dealer_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">{dealer.company_name}</p>
                      <p className="text-xs text-gray-500">{dealer.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
