import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { 
  TrendingUp,
  RefreshCw,
  Save,
  Info,
  Percent
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminExchangeRate = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exchangeData, setExchangeData] = useState(null);
  const [marginPercent, setMarginPercent] = useState('');

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/exchange-rate/chf-eur`);
      setExchangeData(response.data);
      setMarginPercent(response.data.margin_percent.toString());
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      toast.error('Kon wisselkoers niet ophalen');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMargin = async () => {
    const margin = parseFloat(marginPercent);
    if (isNaN(margin) || margin < 0 || margin > 50) {
      toast.error('Marge moet tussen 0% en 50% liggen');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/exchange-rate/margin?margin_percent=${margin}`);
      toast.success(`Marge bijgewerkt naar ${margin}%`);
      fetchExchangeRate(); // Refresh data
    } catch (error) {
      console.error('Failed to update margin:', error);
      toast.error('Kon marge niet bijwerken');
    } finally {
      setSaving(false);
    }
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
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              Wisselkoers Instellingen
            </h1>
            <p className="text-zinc-500 mt-1">Beheer CHF naar EUR conversie marge</p>
          </div>
        </div>
      </div>

      <div className="content-body space-y-6">
        {/* Current Exchange Rate Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Huidige Wisselkoers
            </CardTitle>
            <CardDescription>Real-time koers van exchangerate-api.com</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-sm text-zinc-500 mb-1">Basiskoers</p>
                <p className="text-2xl font-bold text-zinc-900">
                  1 CHF = €{exchangeData?.rate?.toFixed(4)}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-600 mb-1">Huidige Marge</p>
                <p className="text-2xl font-bold text-amber-700">
                  {exchangeData?.margin_percent?.toFixed(1)}%
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Effectieve Koers</p>
                <p className="text-2xl font-bold text-green-700">
                  1 CHF = €{exchangeData?.effective_rate?.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Voorbeeld:</strong> {exchangeData?.example}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Margin Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              Marge Aanpassen
            </CardTitle>
            <CardDescription>
              Stel de marge in die wordt toegevoegd aan de CHF naar EUR conversie
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="margin">Marge Percentage</Label>
                  <div className="flex gap-2">
                    <Input
                      id="margin"
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                      placeholder="9"
                      className="flex-1"
                    />
                    <span className="flex items-center text-zinc-500 font-medium">%</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Standaard: {(exchangeData?.default_margin_percent || 9)}% • Toegestaan: 0% - 50%
                  </p>
                </div>

                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-zinc-500 mr-2">Snel instellen:</span>
                  {[5, 7, 9, 10, 12, 15].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setMarginPercent(preset.toString())}
                      className={marginPercent === preset.toString() ? 'border-red-500 bg-red-50' : ''}
                    >
                      {preset}%
                    </Button>
                  ))}
                </div>

                <Button 
                  onClick={handleSaveMargin} 
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Marge Opslaan
                </Button>
              </div>
            </div>

            {/* Preview calculation */}
            {marginPercent && !isNaN(parseFloat(marginPercent)) && (
              <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
                <p className="text-sm font-medium text-zinc-700 mb-2">Preview met {marginPercent}% marge:</p>
                <div className="space-y-1 text-sm text-zinc-600">
                  <p>CHF 10.000 → €{(10000 * (exchangeData?.rate || 1) * (1 + parseFloat(marginPercent) / 100)).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p>CHF 15.000 → €{(15000 * (exchangeData?.rate || 1) * (1 + parseFloat(marginPercent) / 100)).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p>CHF 25.000 → €{(25000 * (exchangeData?.rate || 1) * (1 + parseFloat(marginPercent) / 100)).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminExchangeRate;
