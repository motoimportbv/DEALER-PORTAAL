import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Save, Plus, X, Trash2, Copy, Upload, ImageIcon, Loader2, Users, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { MOTORCYCLE_DATABASE } from '../../data/motorcycleDatabase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BulkMotorcycleForm = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Dealer-logo blur hoek bij upload. '' = geen blur.
  const [blurCorner, setBlurCorner] = useState('');
  
  // Base motorcycle data (shared)
  const [baseData, setBaseData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    color: '',
    description: '',
    condition: 'good',
    images: [],
    currency: 'EUR',
    auction_duration_hours: 3,
    auto_delete_hours: 24,
    visibility: 'all',  // 'all' or 'selected'
    visible_to_dealers: []
  });
  
  // Individual motorcycles (different mileages)
  const [motorcycles, setMotorcycles] = useState([
    { mileage: '', chassis_number: '', license_plate: '' }
  ]);
  
  // Available dealers for selection
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  
  const [newImageUrl, setNewImageUrl] = useState('');

  // Fetch dealers when visibility changes to 'selected'
  useEffect(() => {
    if (baseData.visibility === 'selected' && dealers.length === 0) {
      fetchDealers();
    }
  }, [baseData.visibility]);

  const fetchDealers = async () => {
    setLoadingDealers(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/dealers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only approved Dutch dealers
      const dutchDealers = response.data.filter(d => 
        d.is_approved && !d.is_foreign_dealer
      );
      setDealers(dutchDealers);
    } catch (error) {
      toast.error('Kon dealers niet laden');
    } finally {
      setLoadingDealers(false);
    }
  };

  const toggleDealerSelection = (dealerId) => {
    setBaseData(prev => {
      const currentSelected = prev.visible_to_dealers || [];
      if (currentSelected.includes(dealerId)) {
        return { ...prev, visible_to_dealers: currentSelected.filter(id => id !== dealerId) };
      } else {
        return { ...prev, visible_to_dealers: [...currentSelected, dealerId] };
      }
    });
  };

  const selectAllDealers = () => {
    setBaseData(prev => ({
      ...prev,
      visible_to_dealers: dealers.map(d => d.id)
    }));
  };

  const deselectAllDealers = () => {
    setBaseData(prev => ({
      ...prev,
      visible_to_dealers: []
    }));
  };

  const handleBaseChange = (field, value) => {
    if (field === 'brand' && value !== baseData.brand) {
      setBaseData(prev => ({ ...prev, brand: value, model: '' }));
    } else {
      setBaseData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleMotorcycleChange = (index, field, value) => {
    setMotorcycles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addMotorcycle = () => {
    if (motorcycles.length >= 20) {
      toast.error('Maximaal 20 motoren per keer');
      return;
    }
    setMotorcycles(prev => [...prev, { mileage: '', chassis_number: '', license_plate: '' }]);
  };

  const removeMotorcycle = (index) => {
    if (motorcycles.length <= 1) {
      toast.error('Minimaal 1 motor vereist');
      return;
    }
    setMotorcycles(prev => prev.filter((_, i) => i !== index));
  };

  const duplicateMotorcycle = (index) => {
    if (motorcycles.length >= 20) {
      toast.error('Maximaal 20 motoren per keer');
      return;
    }
    setMotorcycles(prev => [...prev, { ...prev[index], mileage: '' }]);
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setBaseData(prev => ({
        ...prev,
        images: [...prev.images, newImageUrl.trim()]
      }));
      setNewImageUrl('');
    }
  };

  const removeImage = (index) => {
    setBaseData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const token = localStorage.getItem('token');

    for (let file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const url = blurCorner
          ? `${API}/upload?blur_corner=${encodeURIComponent(blurCorner)}`
          : `${API}/upload`;
        const response = await axios.post(url, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data.url) {
          setBaseData(prev => ({
            ...prev,
            images: [...prev.images, response.data.url]
          }));
          toast.success(`${file.name} geüpload`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Fout bij uploaden: ${file.name}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!baseData.brand || !baseData.model) {
      toast.error('Selecteer een merk en model');
      return;
    }
    
    if (!baseData.price || parseFloat(baseData.price) <= 0) {
      toast.error('Voer een geldige prijs in');
      return;
    }
    
    const validMotorcycles = motorcycles.filter(m => m.mileage && parseInt(m.mileage) >= 0);
    if (validMotorcycles.length === 0) {
      toast.error('Voer minimaal 1 km-stand in');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const payload = {
        ...baseData,
        price: parseFloat(baseData.price),
        year: parseInt(baseData.year),
        motorcycles: validMotorcycles.map(m => ({
          mileage: parseInt(m.mileage),
          chassis_number: m.chassis_number || null,
          license_plate: m.license_plate || null
        }))
      };

      const response = await axios.post(`${API}/motorcycles/bulk`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`${response.data.count} motoren succesvol toegevoegd!`);
      navigate('/admin/motorcycles');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij toevoegen');
    } finally {
      setLoading(false);
    }
  };

  const brands = Object.keys(MOTORCYCLE_DATABASE).sort();
  const models = baseData.brand ? (MOTORCYCLE_DATABASE[baseData.brand] || []) : [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/motorcycles')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Bulk Motoren Toevoegen</h1>
            <p className="text-zinc-500">Voeg meerdere vergelijkbare motoren toe met verschillende km-standen</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Base Motorcycle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Basisgegevens (voor alle motoren)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Merk *</Label>
                  <SearchableSelect
                    options={brands.map(b => ({ value: b, label: b }))}
                    value={baseData.brand}
                    onValueChange={(value) => handleBaseChange('brand', value)}
                    placeholder="Selecteer merk"
                  />
                </div>
                <div>
                  <Label>Model *</Label>
                  <SearchableSelect
                    options={models.map(m => ({ value: m, label: m }))}
                    value={baseData.model}
                    onValueChange={(value) => handleBaseChange('model', value)}
                    placeholder="Selecteer model"
                    disabled={!baseData.brand}
                  />
                </div>
              </div>

              {/* Year, Price, Color */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Bouwjaar *</Label>
                  <Input
                    type="number"
                    value={baseData.year}
                    onChange={(e) => handleBaseChange('year', e.target.value)}
                    min="1950"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div>
                  <Label>Prijs ({baseData.currency}) *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={baseData.price}
                      onChange={(e) => handleBaseChange('price', e.target.value)}
                      placeholder="0"
                      className="flex-1"
                    />
                    <Select value={baseData.currency} onValueChange={(v) => handleBaseChange('currency', v)}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">€</SelectItem>
                        <SelectItem value="CHF">CHF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Kleur *</Label>
                  <Input
                    value={baseData.color}
                    onChange={(e) => handleBaseChange('color', e.target.value)}
                    placeholder="Bijv. Zwart"
                  />
                </div>
              </div>

              {/* Condition */}
              <div>
                <Label>Conditie</Label>
                <Select value={baseData.condition} onValueChange={(v) => handleBaseChange('condition', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nieuw</SelectItem>
                    <SelectItem value="excellent">Uitstekend</SelectItem>
                    <SelectItem value="good">Goed</SelectItem>
                    <SelectItem value="fair">Redelijk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label>Beschrijving</Label>
                <Textarea
                  value={baseData.description}
                  onChange={(e) => handleBaseChange('description', e.target.value)}
                  placeholder="Optionele beschrijving..."
                  rows={3}
                />
              </div>

              {/* Images */}
              <div>
                <Label>Afbeeldingen (voor alle motoren)</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="URL van afbeelding"
                      className="flex-1"
                    />
                    <Button type="button" onClick={addImage} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                  </div>

                  {/* Dealer-logo blur selector (legacy — vervangen door magische gum) */}
                  
                  {baseData.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {baseData.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img src={img} alt="" className="w-full h-20 object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visibility Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Zichtbaarheid
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Wie kan deze motoren zien?</Label>
                <Select value={baseData.visibility} onValueChange={(v) => handleBaseChange('visibility', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Alle dealers
                      </div>
                    </SelectItem>
                    <SelectItem value="selected">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Alleen geselecteerde dealers
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {baseData.visibility === 'selected' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Selecteer dealers ({baseData.visible_to_dealers.length} geselecteerd)</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllDealers}>
                        Alles selecteren
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={deselectAllDealers}>
                        Alles deselecteren
                      </Button>
                    </div>
                  </div>
                  
                  {loadingDealers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                  ) : dealers.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-4">Geen dealers gevonden</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                      {dealers.map((dealer) => (
                        <label
                          key={dealer.id}
                          className="flex items-center gap-3 p-3 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={baseData.visible_to_dealers.includes(dealer.id)}
                            onCheckedChange={() => toggleDealerSelection(dealer.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-zinc-900">{dealer.company_name}</p>
                            <p className="text-sm text-zinc-500">{dealer.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {baseData.visibility === 'selected' && baseData.visible_to_dealers.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                      ⚠️ Geen dealers geselecteerd - deze motoren zijn voor niemand zichtbaar!
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual Motorcycles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Individuele Motoren ({motorcycles.length})
                </span>
                <Button type="button" onClick={addMotorcycle} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Motor toevoegen
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {motorcycles.map((moto, index) => (
                <div key={index} className="flex items-end gap-3 p-4 bg-zinc-50 rounded-lg">
                  <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <Label>KM-stand *</Label>
                    <Input
                      type="number"
                      value={moto.mileage}
                      onChange={(e) => handleMotorcycleChange(index, 'mileage', e.target.value)}
                      placeholder="Bijv. 15000"
                      min="0"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <Label>Chassisnummer</Label>
                    <Input
                      value={moto.chassis_number}
                      onChange={(e) => handleMotorcycleChange(index, 'chassis_number', e.target.value)}
                      placeholder="Optioneel"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <Label>Kenteken</Label>
                    <Input
                      value={moto.license_plate}
                      onChange={(e) => handleMotorcycleChange(index, 'license_plate', e.target.value)}
                      placeholder="Optioneel"
                    />
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateMotorcycle(index)}
                      title="Dupliceer"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMotorcycle(index)}
                      className="text-red-500 hover:text-red-700"
                      title="Verwijder"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {motorcycles.length < 20 && (
                <Button
                  type="button"
                  onClick={addMotorcycle}
                  variant="outline"
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nog een motor toevoegen
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/motorcycles')}
              className="flex-1"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {motorcycles.filter(m => m.mileage).length} Motor(en) Toevoegen
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default BulkMotorcycleForm;
