import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { MessageCircle, Send, ExternalLink, Check, Loader2, Bike } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminWhatsAppBroadcast() {
  const [searchParams] = useSearchParams();
  const [motorcycles, setMotorcycles] = useState([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [dealerLinks, setDealerLinks] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState([]);

  useEffect(() => {
    fetchMotorcycles();
  }, []);

  // Auto-select motorcycle from URL parameter
  useEffect(() => {
    const motorcycleId = searchParams.get('motorcycle');
    if (motorcycleId && motorcycles.length > 0) {
      loadDealerLinks(motorcycleId);
    }
  }, [searchParams, motorcycles]);

  const fetchMotorcycles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motorcycles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only available motorcycles
      const available = response.data.filter(m => m.is_available);
      setMotorcycles(available);
    } catch (error) {
      toast.error('Kon motoren niet laden');
    }
  };

  const loadDealerLinks = async (motorcycleId) => {
    setLoading(true);
    setSentTo([]);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/motorcycles/${motorcycleId}/whatsapp-share-all-dealers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMotorcycle(response.data.motorcycle);
      setDealerLinks(response.data.dealers);
      setMessage(response.data.message);
      
      if (response.data.dealers.length === 0) {
        toast.warning('Geen dealers met telefoonnummer gevonden');
      }
    } catch (error) {
      toast.error('Kon dealer links niet laden');
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (dealer) => {
    window.open(dealer.whatsapp_url, '_blank');
    setSentTo(prev => [...prev, dealer.dealer_id]);
  };

  const openAllSequentially = () => {
    // Open WhatsApp links one by one with delay
    dealerLinks.forEach((dealer, index) => {
      setTimeout(() => {
        window.open(dealer.whatsapp_url, '_blank');
        setSentTo(prev => [...prev, dealer.dealer_id]);
      }, index * 1500); // 1.5 second delay between each
    });
    
    toast.success(`Opening ${dealerLinks.length} WhatsApp vensters...`);
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Broadcast</h1>
            <p className="text-gray-500">Stuur motor updates naar 🇳🇱 Nederlandse dealers via WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Motorcycle Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5" />
                Selecteer Motor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {motorcycles.map((moto) => (
                <button
                  key={moto.id}
                  onClick={() => loadDealerLinks(moto.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedMotorcycle?.id === moto.id
                      ? 'bg-green-50 border-green-500'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="font-medium">
                    {moto.brand} {moto.model}
                  </div>
                  <div className="text-sm text-gray-500">
                    {moto.year} • €{moto.price?.toLocaleString()}
                  </div>
                </button>
              ))}
              {motorcycles.length === 0 && (
                <p className="text-gray-500 text-sm">Geen beschikbare motoren</p>
              )}
            </CardContent>
          </Card>

          {/* Dealer List & Send */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Dealers ({dealerLinks.length})
                </span>
                {dealerLinks.length > 0 && (
                  <Button 
                    onClick={openAllSequentially}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Open Alle ({dealerLinks.length})
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
              )}

              {!loading && !selectedMotorcycle && (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecteer een motor om WhatsApp links te genereren</p>
                </div>
              )}

              {!loading && selectedMotorcycle && (
                <div className="space-y-4">
                  {/* Preview Message */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Bericht preview:</p>
                    <pre className="whitespace-pre-wrap text-sm font-sans">{message}</pre>
                  </div>

                  {/* Dealer List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dealerLinks.map((dealer) => (
                      <div 
                        key={dealer.dealer_id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          sentTo.includes(dealer.dealer_id) 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{dealer.company_name}</p>
                          <p className="text-sm text-gray-500">+{dealer.phone}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openWhatsApp(dealer)}
                          className={sentTo.includes(dealer.dealer_id) 
                            ? 'bg-green-600' 
                            : 'bg-green-500 hover:bg-green-600'
                          }
                        >
                          {sentTo.includes(dealer.dealer_id) ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {dealerLinks.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <p>Geen dealers met telefoonnummer gevonden.</p>
                      <p className="text-sm">Zorg dat dealers hun telefoonnummer hebben ingevuld.</p>
                    </div>
                  )}

                  {/* Stats */}
                  {dealerLinks.length > 0 && (
                    <div className="flex gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{sentTo.length}</p>
                        <p className="text-xs text-gray-500">Geopend</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-400">{dealerLinks.length - sentTo.length}</p>
                        <p className="text-xs text-gray-500">Nog te doen</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
