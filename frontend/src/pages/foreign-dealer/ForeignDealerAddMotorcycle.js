import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { toast } from 'sonner';
import { Upload, Bike, ArrowLeft, Globe } from 'lucide-react';
import { MOTORCYCLE_DATABASE as MOTORCYCLE_DATABASE_IMPORT } from '../../data/motorcycleDatabase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOTORCYCLE_DATABASE = MOTORCYCLE_DATABASE_IMPORT;

const MOTORCYCLE_BRANDS = Object.keys(MOTORCYCLE_DATABASE).sort();

// Bouwjaren van 1960 tot huidig jaar + 1
const YEARS = Array.from({ length: new Date().getFullYear() - 1960 + 2 }, (_, i) => new Date().getFullYear() + 1 - i);

const ForeignDealerAddMotorcycle = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [exchangeData, setExchangeData] = useState(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    currency: 'CHF',  // Default to CHF for Swiss dealers
    starting_price: '',
    mileage: '',
    color: '',
    description: '',
    condition: 'good',
    images: [],
    chassis_number: '',
    has_maintenance_history: null,  // Required field
    maintenance_history_details: ''
  });

  // Fetch exchange rate on mount
  React.useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await axios.get(`${API}/exchange-rate/chf-eur`);
        setExchangeData(response.data);
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
      }
    };
    fetchRate();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field, value) => {
    // Reset model when brand changes
    if (field === 'brand' && value !== formData.brand) {
      setFormData(prev => ({ ...prev, brand: value, model: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    const uploadedUrls = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post(`${API}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
        uploadedUrls.push(response.data.url);
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Upload failed: ${file.name}`);
      }
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...uploadedUrls]
    }));
    setUploadingImage(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.brand || !formData.model || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Validate maintenance history is selected
    if (formData.has_maintenance_history === null) {
      toast.error(t('foreignDealer.maintenanceRequired', 'Geef aan of er onderhoudshistorie aanwezig is'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        year: parseInt(formData.year),
        price: parseFloat(formData.price),
        starting_price: formData.starting_price ? parseFloat(formData.starting_price) : parseFloat(formData.price) * 0.8,
        mileage: parseInt(formData.mileage) || 0,
        auction_duration_hours: 0,
        has_maintenance_history: formData.has_maintenance_history,
        maintenance_history_details: formData.maintenance_history_details || null
      };

      await axios.post(`${API}/motorcycles/foreign-listing`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Motorcycle submitted for review!');
      navigate('/foreign-dealer');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Could not submit motorcycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="content-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/foreign-dealer')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('foreignDealer.addMotorcycle')}
            </h1>
            <p className="text-zinc-500 mt-1">{t('foreignDealer.infoMessage')}</p>
          </div>
        </div>
      </div>

      <div className="content-body">
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Bike className="w-5 h-5" />
              {t('motorcycle.addMotorcycle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">{t('motorcycle.brand')} *</Label>
                  <SearchableSelect
                    options={MOTORCYCLE_BRANDS}
                    value={formData.brand}
                    onValueChange={(value) => handleSelectChange('brand', value)}
                    placeholder="Kies een merk"
                    searchPlaceholder="Zoek merk..."
                    emptyText="Geen resultaten"
                    data-testid="foreign-brand-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">{t('motorcycle.model')} *</Label>
                  <SearchableSelect
                    options={formData.brand ? MOTORCYCLE_DATABASE[formData.brand] || [] : []}
                    value={formData.model}
                    onValueChange={(value) => handleSelectChange('model', value)}
                    placeholder={formData.brand ? "Kies een model" : "Kies eerst een merk"}
                    searchPlaceholder="Zoek model..."
                    emptyText="Geen resultaten"
                    disabled={!formData.brand}
                    data-testid="foreign-model-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">{t('motorcycle.year')} *</Label>
                  <SearchableSelect
                    options={YEARS.map(y => y.toString())}
                    value={formData.year?.toString()}
                    onValueChange={(value) => handleSelectChange('year', value)}
                    placeholder="Kies jaar"
                    searchPlaceholder="Zoek jaar..."
                    emptyText="Geen resultaten"
                    data-testid="foreign-year-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">{t('motorcycle.mileage')}</Label>
                  <Input
                    id="mileage"
                    name="mileage"
                    type="number"
                    min="0"
                    value={formData.mileage}
                    onChange={handleChange}
                    placeholder="e.g. 15000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">{t('motorcycle.color')}</Label>
                  <Input
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="e.g. Green"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chassis_number">{t('motorcycle.chassisNumber')} *</Label>
                  <Input
                    id="chassis_number"
                    name="chassis_number"
                    value={formData.chassis_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, chassis_number: e.target.value.toUpperCase() }))}
                    placeholder={t('motorcycle.chassisNumberPlaceholder')}
                    required
                    maxLength={17}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">{t('motorcycle.condition')}</Label>
                  <select
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="new">{t('motorcycle.new')}</option>
                    <option value="excellent">{t('motorcycle.excellent')}</option>
                    <option value="good">{t('motorcycle.good')}</option>
                    <option value="fair">{t('motorcycle.fair')}</option>
                  </select>
                </div>
                
                {/* Maintenance History - Required */}
                <div className="space-y-2 lg:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label className="text-blue-900 font-semibold">
                    {t('foreignDealer.maintenanceHistory', 'Onderhoudshistorie')} *
                  </Label>
                  <p className="text-sm text-blue-700 mb-3">
                    {t('foreignDealer.maintenanceHistoryDescription', 'Is er onderhoudshistorie/serviceboekje aanwezig bij deze motor?')}
                  </p>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${formData.has_maintenance_history === true ? 'border-green-500 bg-green-50' : 'border-zinc-200 hover:border-green-300'}`}>
                      <input
                        type="radio"
                        name="has_maintenance_history"
                        checked={formData.has_maintenance_history === true}
                        onChange={() => setFormData(prev => ({ ...prev, has_maintenance_history: true }))}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="font-medium text-green-700">✓ {t('foreignDealer.hasHistory', 'Ja, aanwezig')}</span>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${formData.has_maintenance_history === false ? 'border-red-500 bg-red-50' : 'border-zinc-200 hover:border-red-300'}`}>
                      <input
                        type="radio"
                        name="has_maintenance_history"
                        checked={formData.has_maintenance_history === false}
                        onChange={() => setFormData(prev => ({ ...prev, has_maintenance_history: false }))}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="font-medium text-red-700">✗ {t('foreignDealer.noHistory', 'Nee, niet aanwezig')}</span>
                    </label>
                  </div>
                  {formData.has_maintenance_history === true && (
                    <div className="mt-3">
                      <Label htmlFor="maintenance_details" className="text-blue-800">
                        {t('foreignDealer.maintenanceDetails', 'Details (optioneel)')}
                      </Label>
                      <Input
                        id="maintenance_details"
                        name="maintenance_history_details"
                        value={formData.maintenance_history_details}
                        onChange={handleChange}
                        placeholder={t('foreignDealer.maintenanceDetailsPlaceholder', 'Bijv. Volledig dealeronderhouden, laatste beurt 5000 km geleden')}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price">{t('foreignDealer.purchasePrice')} *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => handleSelectChange('currency', value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHF">CHF</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleChange}
                      placeholder="e.g. 8500"
                      required
                      className="flex-1"
                    />
                  </div>
                  {/* Real-time EUR conversion display with margin */}
                  {formData.currency === 'CHF' && formData.price && exchangeData && (
                    <p className="text-sm text-zinc-500 mt-1">
                      ≈ €{(parseFloat(formData.price) * exchangeData.effective_rate).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} EUR
                      <span className="text-xs text-zinc-400 ml-1">
                        (koers: {exchangeData.rate.toFixed(4)} + {exchangeData.margin_percent}% marge)
                      </span>
                    </p>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                    <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                      <span className="text-amber-500">⚠️</span>
                      {t('foreignDealer.priceWarning')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('motorcycle.description')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the motorcycle..."
                  rows={4}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>{t('motorcycle.images')}</Label>
                <div className="border-2 border-dashed border-purple-200 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className={`w-8 h-8 ${uploadingImage ? 'text-purple-300 animate-pulse' : 'text-purple-400'}`} />
                    <span className="text-zinc-600">
                      {uploadingImage ? 'Uploading...' : 'Click to upload photos'}
                    </span>
                  </label>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={url}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/foreign-dealer')}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    t('common.submit')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ForeignDealerAddMotorcycle;
