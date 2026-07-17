import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { toast } from 'sonner';
import { Upload, Bike, ArrowLeft, Info } from 'lucide-react';
import { MOTORCYCLE_DATABASE as MOTORCYCLE_DATABASE_IMPORT } from '../../data/motorcycleDatabase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOTORCYCLE_DATABASE = MOTORCYCLE_DATABASE_IMPORT;

const MOTORCYCLE_BRANDS = Object.keys(MOTORCYCLE_DATABASE).sort();

// Bouwjaren van 1960 tot huidig jaar + 1
const YEARS = Array.from({ length: new Date().getFullYear() - 1960 + 2 }, (_, i) => new Date().getFullYear() + 1 - i);

const DealerSellMotorcycle = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    starting_price: '',
    mileage: '',
    color: '',
    description: '',
    condition: 'good',
    images: [],
    chassis_number: ''
  });

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
        toast.error(`Kon ${file.name} niet uploaden`);
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
      toast.error('Vul alle verplichte velden in');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        year: parseInt(formData.year),
        price: parseFloat(formData.price),
        starting_price: parseFloat(formData.price), // Same as price - no auction
        mileage: parseInt(formData.mileage) || 0,
        auction_duration_hours: 0
      };

      await axios.post(`${API}/motorcycles/dealer-listing`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Motor succesvol geplaatst!');
      navigate('/dealer/my-listings');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Kon motor niet plaatsen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="content-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dealer')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('nav.sellMotorcycle')}
            </h1>
            <p className="text-zinc-500 mt-1">{t('sell.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="content-body">
        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">{t('fees.listingFee')}: {t('fees.feeAmount')}</p>
            <p className="text-amber-700 text-sm">
              {t('sell.feeInfo')}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Bike className="w-5 h-5" />
              {t('sell.motorcycleDetails')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="brand">{t('motorcycle.brand')} *</Label>
                  <SearchableSelect
                    options={MOTORCYCLE_BRANDS}
                    value={formData.brand}
                    onValueChange={(value) => handleSelectChange('brand', value)}
                    placeholder={t('sell.brandPlaceholder')}
                    searchPlaceholder={t('sell.searchBrand') || "Zoek merk..."}
                    emptyText={t('common.noResults') || "Geen resultaten"}
                    data-testid="dealer-brand-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">{t('motorcycle.model')} *</Label>
                  <SearchableSelect
                    options={formData.brand ? MOTORCYCLE_DATABASE[formData.brand] || [] : []}
                    value={formData.model}
                    onValueChange={(value) => handleSelectChange('model', value)}
                    placeholder={formData.brand ? t('sell.modelPlaceholder') : t('sell.selectBrandFirst')}
                    searchPlaceholder={t('sell.searchModel') || "Zoek model..."}
                    emptyText={t('common.noResults') || "Geen resultaten"}
                    disabled={!formData.brand}
                    data-testid="dealer-model-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">{t('motorcycle.year')} *</Label>
                  <SearchableSelect
                    options={YEARS.map(y => y.toString())}
                    value={formData.year?.toString()}
                    onValueChange={(value) => handleSelectChange('year', value)}
                    placeholder="Kies jaar"
                    searchPlaceholder={t('sell.searchYear') || "Zoek jaar..."}
                    emptyText={t('common.noResults') || "Geen resultaten"}
                    data-testid="dealer-year-select"
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
                    placeholder={t('sell.mileagePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">{t('motorcycle.color')}</Label>
                  <Input
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder={t('sell.colorPlaceholder')}
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
                <div className="space-y-2">
                  <Label htmlFor="price">{t('motorcycle.askingPrice')} (€) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder={t('sell.pricePlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('motorcycle.description')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder={t('sell.descriptionPlaceholder')}
                  rows={4}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>{t('motorcycle.images')}</Label>
                <div className="border-2 border-dashed border-zinc-200 rounded-lg p-6 text-center">
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
                    <Upload className={`w-8 h-8 ${uploadingImage ? 'text-zinc-300 animate-pulse' : 'text-zinc-400'}`} />
                    <span className="text-zinc-600">
                      {uploadingImage ? t('sell.uploading') : t('sell.clickToUpload')}
                    </span>
                  </label>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
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
                  onClick={() => navigate('/dealer')}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    t('sell.submitListing')
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

export default DealerSellMotorcycle;
