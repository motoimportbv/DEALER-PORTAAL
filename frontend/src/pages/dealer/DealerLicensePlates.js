import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  CreditCard, 
  Hash,
  Calendar,
  FileText,
  Bike
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerLicensePlates = () => {
  const { t } = useTranslation();
  const [licensePlates, setLicensePlates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLicensePlates();
  }, []);

  const fetchLicensePlates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/license-plates/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLicensePlates(response.data);
    } catch (error) {
      console.error('Error fetching license plates:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="content-header">
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            {t('nav.licensePlates') || 'Mijn Kentekens'}
          </h1>
          <p className="text-zinc-500 mt-1">
            {licensePlates.length} {licensePlates.length === 1 ? 'kenteken' : 'kentekens'} geregistreerd
          </p>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-license-plates">
        {licensePlates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                Geen kentekens
              </h3>
              <p className="text-zinc-500">
                Wanneer Moto Import kentekens aan u toewijst, verschijnen ze hier.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {licensePlates.map((plate) => (
              <Card key={plate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* License Plate Display */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-yellow-400 border-2 border-black rounded-lg px-6 py-3 font-mono font-bold text-2xl text-black tracking-wider shadow-md">
                      {plate.license_plate}
                    </div>
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-3">
                    {(plate.brand || plate.model) && (
                      <div className="flex items-center justify-center gap-2">
                        <Bike className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium text-zinc-700">
                          {plate.brand} {plate.model}
                        </span>
                      </div>
                    )}
                    
                    {plate.chassis_number && (
                      <div className="flex items-center justify-center gap-2 text-sm text-zinc-600">
                        <Hash className="w-4 h-4 text-zinc-400" />
                        <span className="font-mono">{plate.chassis_number}</span>
                      </div>
                    )}
                    
                    {plate.notes && (
                      <div className="flex items-start justify-center gap-2 text-sm text-zinc-500 bg-zinc-50 rounded-lg p-2">
                        <FileText className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                        <span>{plate.notes}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-2 border-t">
                      <Calendar className="w-3 h-3" />
                      <span>Toegevoegd: {formatDate(plate.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DealerLicensePlates;
