import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Save, Plus, X, ImageIcon, Camera, Upload, Loader2, MessageCircle, Share2, Users, Eye, EyeOff, ChevronUp, ChevronDown, Star, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import ManualInpaintModal from '../../components/ManualInpaintModal';
import { MOTORCYCLE_DATABASE as MOTORCYCLE_DATABASE_IMPORT } from '../../data/motorcycleDatabase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOTORCYCLE_DATABASE = MOTORCYCLE_DATABASE_IMPORT;

const MOTORCYCLE_BRANDS = Object.keys(MOTORCYCLE_DATABASE).sort();

// Bouwjaren van 1960 tot huidig jaar + 1
const YEARS = Array.from({ length: new Date().getFullYear() - 1960 + 2 }, (_, i) => new Date().getFullYear() + 1 - i);

const MotorcycleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    purchase_price: '',  // Inkoopprijs - alleen zichtbaar voor admin
    starting_price: '',
    mileage: '',
    color: '',
    description: '',
    condition: 'good',
    images: [],
    is_available: true,
    chassis_number: '',
    license_plate: '',
    auto_delete_hours: 24,  // Default 24 hours
    currency: 'EUR',  // EUR or CHF
    visibility: 'all',  // 'all' or 'selected'
    visible_to_dealers: []
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const fileInputRef = useRef(null);

  // Dealer-logo blur hoek bij upload. '' = geen blur.
  const [blurCorner, setBlurCorner] = useState('');
  // Manual inpaint editor state
  const [inpaintUrl, setInpaintUrl] = useState(null);
  const [inpaintCacheBust, setInpaintCacheBust] = useState({});
  
  // CHF supplier price editing
  const [supplierChfPrice, setSupplierChfPrice] = useState('');
  const [savingSupplierPrice, setSavingSupplierPrice] = useState(false);
  
  // Motor bron (leverancier of particulier)
  const [motorSource, setMotorSource] = useState('own'); // 'own', 'supplier', 'private'
  const [foreignDealers, setForeignDealers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  // Dealers for visibility selection
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  
  // CHF/EUR exchange rate
  const [exchangeRate, setExchangeRate] = useState(null);
  const [eurPreview, setEurPreview] = useState(null);
  
  // Fetch dealers and foreign dealers
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API}/dealers`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const dutchDealers = res.data.filter(d => d.is_approved && !d.is_foreign_dealer);
          setDealers(dutchDealers);
          const foreign = res.data.filter(d => d.is_foreign_dealer || d.role === 'foreign_dealer');
          setForeignDealers(foreign);
        }).catch(() => {});
    }
  }, []);

  const toggleDealerSelection = (dealerId) => {
    setFormData(prev => {
      const currentSelected = prev.visible_to_dealers || [];
      if (currentSelected.includes(dealerId)) {
        return { ...prev, visible_to_dealers: currentSelected.filter(id => id !== dealerId) };
      } else {
        return { ...prev, visible_to_dealers: [...currentSelected, dealerId] };
      }
    });
  };

  const selectAllDealers = () => {
    setFormData(prev => ({
      ...prev,
      visible_to_dealers: dealers.map(d => d.id)
    }));
  };

  const deselectAllDealers = () => {
    setFormData(prev => ({
      ...prev,
      visible_to_dealers: []
    }));
  };
  
  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await axios.get(`${API}/exchange-rate/chf-eur`);
        setExchangeRate(response.data.rate);
      } catch (error) {
        console.error('Could not fetch exchange rate:', error);
      }
    };
    fetchExchangeRate();
  }, []);
  
  // Calculate EUR preview when CHF price changes
  useEffect(() => {
    if (formData.currency === 'CHF' && formData.price && exchangeRate) {
      const eurAmount = parseFloat(formData.price) * exchangeRate;
      setEurPreview(eurAmount.toFixed(0));
    } else {
      setEurPreview(null);
    }
  }, [formData.price, formData.currency, exchangeRate]);

  useEffect(() => {
    if (isEditing) {
      fetchMotorcycle();
    }
  }, [id]);

  const fetchMotorcycle = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/motorcycles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData(response.data);
      // Set supplier CHF price if this is a CHF motorcycle
      if (response.data.original_currency === 'CHF' && response.data.original_price) {
        setSupplierChfPrice(response.data.original_price.toString());
      }
    } catch (error) {
      toast.error('Kon motor niet laden');
      navigate('/admin/motorcycles');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (field, value) => {
    // Reset model when brand changes
    if (field === 'brand' && value !== formData.brand) {
      setFormData(prev => ({ ...prev, brand: value, model: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveSupplierChfPrice = async () => {
    if (!supplierChfPrice || parseFloat(supplierChfPrice) <= 0) return;
    setSavingSupplierPrice(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API}/motorcycles/foreign-listings/${id}/price`,
        { price: parseFloat(supplierChfPrice) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`CHF prijs bijgewerkt → nieuwe verkoopprijs: €${response.data.new_selling_price?.toLocaleString('nl-NL')}`);
      // Refresh motorcycle data to show updated EUR price
      await fetchMotorcycle();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kon CHF prijs niet bijwerken');
    } finally {
      setSavingSupplierPrice(false);
    }
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newImageUrl.trim()]
      }));
      setNewImageUrl('');
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const moveImage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= formData.images.length) return;
    setFormData(prev => {
      const newImages = [...prev.images];
      const [movedImage] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedImage);
      return { ...prev, images: newImages };
    });
  };

  const setAsMainImage = (index) => {
    if (index === 0) return;
    moveImage(index, 0);
    toast.success('Hoofdfoto ingesteld');
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      try {
        const url = blurCorner
          ? `${API}/upload?blur_corner=${encodeURIComponent(blurCorner)}`
          : `${API}/upload`;
        const response = await axios.post(url, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrls.push(response.data.url);
      } catch (error) {
        toast.error(`Kon ${file.name} niet uploaden`);
      }
    }

    if (uploadedUrls.length > 0) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} foto('s) geüpload`);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // WhatsApp share state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [newMotorcycleId, setNewMotorcycleId] = useState(null);

  const handleWhatsAppShare = (motorcycleId) => {
    setNewMotorcycleId(motorcycleId);
    setShowWhatsAppModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        starting_price: parseFloat(formData.price),
        mileage: parseInt(formData.mileage),
        year: parseInt(formData.year)
      };

      // Add source info
      if (motorSource === 'supplier' && selectedSupplierId) {
        const supplier = foreignDealers.find(s => s.id === selectedSupplierId);
        if (supplier) {
          payload.is_foreign_listing = true;
          payload.foreign_dealer_id = supplier.id;
          payload.foreign_dealer_company = supplier.company_name;
          if (formData.currency === 'CHF') {
            payload.original_price = parseFloat(formData.price);
            payload.original_currency = 'CHF';
          }
        }
      } else if (motorSource === 'private') {
        payload.is_private_source = true;
      }

      if (isEditing) {
        const token = localStorage.getItem('token');
        await axios.put(`${API}/motorcycles/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Motor bijgewerkt');
        navigate('/admin/motorcycles');
      } else {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API}/motorcycles`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // If linked to a supplier, update the motorcycle with foreign dealer info
        if (motorSource === 'supplier' && selectedSupplierId && response.data?.id) {
          const supplier = foreignDealers.find(s => s.id === selectedSupplierId);
          if (supplier) {
            await axios.put(`${API}/motorcycles/${response.data.id}/source`, {
              is_foreign_listing: true,
              foreign_dealer_id: supplier.id,
              foreign_dealer_company: supplier.company_name,
            }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          }
        }
        if (motorSource === 'private' && response.data?.id) {
          await axios.put(`${API}/motorcycles/${response.data.id}/source`, {
            is_private_source: true,
          }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        }
        
        toast.success('Motor toegevoegd');
        
        // Show WhatsApp share option for new motorcycles
        if (response.data?.id) {
          handleWhatsAppShare(response.data.id);
        } else {
          navigate('/admin/motorcycles');
        }
      }
    } catch (error) {
      // Handle Pydantic validation errors (array) or regular errors (string)
      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        // Pydantic returns array of error objects
        const messages = errorDetail.map(e => e.msg || 'Validatiefout').join(', ');
        toast.error(messages);
      } else {
        toast.error(errorDetail || 'Er ging iets mis');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin/motorcycles')}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {isEditing ? 'Motor Bewerken' : 'Nieuwe Motor'}
            </h1>
            <p className="text-zinc-500 mt-1">
              {isEditing ? 'Pas de motorgegevens aan' : 'Voeg een nieuwe motor toe aan uw voorraad'}
            </p>
          </div>
        </div>
      </div>

      <div className="content-body">
        <form onSubmit={handleSubmit} data-testid="motorcycle-form">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                  Basis Informatie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bron selectie - alleen bij nieuwe motor */}
                {!isEditing && (
                  <div className="bg-zinc-50 rounded-xl p-4 space-y-3" data-testid="motor-source-select">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">Bron</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'own', label: 'Eigen inkoop' },
                        { value: 'supplier', label: 'Leverancier' },
                        { value: 'private', label: 'Particulier' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => { setMotorSource(opt.value); if (opt.value !== 'supplier') setSelectedSupplierId(''); }}
                          className={`py-2.5 px-3 rounded-lg text-sm font-bold border-2 transition-all ${motorSource === opt.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                          data-testid={`source-${opt.value}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {motorSource === 'supplier' && (
                      <div>
                        <select value={selectedSupplierId} onChange={(e) => {
                          setSelectedSupplierId(e.target.value);
                          if (e.target.value) setFormData(prev => ({ ...prev, currency: 'CHF' }));
                          // Auto-detect Mundi Moto → blur rechtsonder
                          const picked = foreignDealers.find(s => s.id === e.target.value);
                          if (picked && /mundi/i.test(picked.company_name || '')) {
                            setBlurCorner('top-left');
                            toast.info('Mundi Moto gedetecteerd — logo wordt automatisch geblurd (linksboven).');
                          }
                        }}
                          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                          data-testid="supplier-select-form">
                          <option value="">-- Kies leverancier --</option>
                          {foreignDealers.map(s => (
                            <option key={s.id} value={s.id}>{s.company_name} ({s.country})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Merk *
                    </Label>
                    <SearchableSelect
                      options={MOTORCYCLE_BRANDS}
                      value={formData.brand}
                      onValueChange={(value) => handleChange('brand', value)}
                      placeholder="Kies een merk"
                      searchPlaceholder="Zoek merk... (bijv. Yamaha)"
                      emptyText="Geen merk gevonden"
                      data-testid="brand-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Model *
                    </Label>
                    <SearchableSelect
                      options={formData.brand ? MOTORCYCLE_DATABASE[formData.brand] || [] : []}
                      value={formData.model}
                      onValueChange={(value) => handleChange('model', value)}
                      placeholder={formData.brand ? "Kies een model" : "Kies eerst een merk"}
                      searchPlaceholder="Zoek model..."
                      emptyText="Geen model gevonden"
                      disabled={!formData.brand}
                      data-testid="model-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Bouwjaar *
                    </Label>
                    <SearchableSelect
                      options={YEARS.map(y => y.toString())}
                      value={formData.year?.toString()}
                      onValueChange={(value) => handleChange('year', value)}
                      placeholder="Kies jaar"
                      searchPlaceholder="Zoek jaar... (bijv. 2020)"
                      emptyText="Geen jaar gevonden"
                      data-testid="year-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Valuta
                    </Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(value) => handleChange('currency', value)}
                    >
                      <SelectTrigger data-testid="currency-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">🇪🇺 EUR (Euro)</SelectItem>
                        <SelectItem value="CHF">🇨🇭 CHF (Zwitserse Frank)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Prijs ({formData.currency === 'CHF' ? 'CHF' : '€'}) *
                    </Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleChange('price', e.target.value)}
                      placeholder="25000"
                      min="0"
                      data-testid="price-input"
                      required
                    />
                    {formData.currency === 'CHF' && eurPreview && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        ≈ €{Number(eurPreview).toLocaleString('nl-NL')} EUR (live koers: 1 CHF = {exchangeRate?.toFixed(4)} EUR)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 flex items-center gap-2">
                      Inkoopprijs (€)
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-normal normal-case">Alleen admin</span>
                    </Label>
                    <Input
                      type="number"
                      value={formData.purchase_price}
                      onChange={(e) => handleChange('purchase_price', e.target.value)}
                      placeholder="20000"
                      min="0"
                      data-testid="purchase-price-input"
                    />
                    {formData.price && formData.purchase_price && (
                      <p className="text-sm text-green-600">
                        Marge: €{(Number(formData.price) - Number(formData.purchase_price)).toLocaleString('nl-NL')} 
                        ({((Number(formData.price) - Number(formData.purchase_price)) / Number(formData.purchase_price) * 100).toFixed(1)}%)
                      </p>
                    )}
                  </div>
                </div>

                {/* CHF Supplier Price Editor - only shown when editing a CHF motorcycle */}
                {isEditing && formData.original_currency === 'CHF' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3" data-testid="chf-supplier-price-editor">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇨🇭</span>
                      <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-amber-700">
                        Leveranciersprijs (CHF)
                      </Label>
                    </div>
                    <p className="text-xs text-amber-600">
                      Pas de CHF inkoopprijs van de leverancier aan. De EUR verkoopprijs wordt automatisch herberekend op basis van de live wisselkoers.
                    </p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={supplierChfPrice}
                          onChange={(e) => setSupplierChfPrice(e.target.value)}
                          placeholder="CHF prijs"
                          min="0"
                          step="100"
                          data-testid="supplier-chf-price-input"
                          className="border-amber-300 focus:border-amber-500"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleSaveSupplierChfPrice}
                        disabled={savingSupplierPrice || !supplierChfPrice || parseFloat(supplierChfPrice) <= 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        data-testid="save-supplier-chf-price-btn"
                      >
                        {savingSupplierPrice ? 'Opslaan...' : 'CHF Prijs Opslaan'}
                      </Button>
                    </div>
                    {supplierChfPrice && exchangeRate && (
                      <p className="text-xs text-amber-600">
                        CHF {Number(supplierChfPrice).toLocaleString('nl-NL')} ≈ €{Math.round(Number(supplierChfPrice) * exchangeRate).toLocaleString('nl-NL')} EUR (koers: {exchangeRate.toFixed(4)})
                      </p>
                    )}
                    {formData.original_price && (
                      <p className="text-xs text-zinc-500">
                        Huidige leveranciersprijs: CHF {Number(formData.original_price).toLocaleString('nl-NL')}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Kilometerstand *
                    </Label>
                    <Input
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => handleChange('mileage', e.target.value)}
                      placeholder="15000"
                      min="0"
                      data-testid="mileage-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Kleur *
                    </Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => handleChange('color', e.target.value)}
                      placeholder="bijv. Rosso Corsa"
                      data-testid="color-input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Chassisnummer (VIN) *
                    </Label>
                    <Input
                      value={formData.chassis_number}
                      onChange={(e) => handleChange('chassis_number', e.target.value.toUpperCase())}
                      placeholder="bijv. WB10408J09ZT12345"
                      data-testid="chassis-number-input"
                      required
                      maxLength={17}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Kenteken
                    </Label>
                    <Input
                      value={formData.license_plate || ''}
                      onChange={(e) => handleChange('license_plate', e.target.value.toUpperCase())}
                      placeholder="bijv. AB-123-CD"
                      data-testid="license-plate-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Conditie *
                    </Label>
                    <Select 
                      value={formData.condition} 
                      onValueChange={(value) => handleChange('condition', value)}
                    >
                      <SelectTrigger data-testid="condition-select">
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

                <div className="space-y-2">
                  <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                    Beschrijving
                  </Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Geef een uitgebreide beschrijving van de motor..."
                    rows={4}
                    data-testid="description-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">Beschikbaar</p>
                      <p className="text-sm text-zinc-500">Zichtbaar voor dealers</p>
                    </div>
                    <Switch
                      checked={formData.is_available}
                      onCheckedChange={(checked) => handleChange('is_available', checked)}
                      data-testid="availability-switch"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Auto-Delete Settings */}
              {!isEditing && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                      ⏰ Auto-Verwijdering
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-amber-800">
                        Motor wordt automatisch verwijderd als deze niet verkocht is binnen:
                      </p>
                      <Select
                        value={String(formData.auto_delete_hours)}
                        onValueChange={(value) => handleChange('auto_delete_hours', parseInt(value))}
                      >
                        <SelectTrigger data-testid="auto-delete-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">❌ Niet automatisch verwijderen</SelectItem>
                          <SelectItem value="12">12 uur</SelectItem>
                          <SelectItem value="24">24 uur (standaard)</SelectItem>
                          <SelectItem value="48">48 uur</SelectItem>
                          <SelectItem value="72">72 uur (3 dagen)</SelectItem>
                          <SelectItem value="168">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.auto_delete_hours > 0 && (
                        <p className="text-xs text-amber-600">
                          ⚠️ Na {formData.auto_delete_hours} uur wordt deze motor automatisch verwijderd als hij niet verkocht is.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                    Afbeeldingen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Upload buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      data-testid="file-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="upload-btn"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = (e) => handleFileUpload(e);
                        input.click();
                      }}
                      disabled={uploading}
                      data-testid="camera-btn"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Maak Foto
                    </Button>
                  </div>

                  {/* URL input (optional) */}
                  <div className="flex gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Of plak een URL..."
                      className="text-sm"
                      data-testid="image-url-input"
                    />
                    <Button type="button" onClick={addImage} variant="outline" size="icon" data-testid="add-image-btn">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {formData.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {formData.images.map((url, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 group">
                          <img src={`${url}?thumb=true&v=${inpaintCacheBust[url] || ''}`} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
                          
                          {/* Main image badge */}
                          {index === 0 && (
                            <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3" /> Hoofd
                            </div>
                          )}
                          
                          {/* Controls overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {/* Move up */}
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, index - 1)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
                                title="Naar boven"
                              >
                                <ChevronUp className="w-5 h-5" />
                              </button>
                            )}
                            
                            {/* Set as main */}
                            {index !== 0 && (
                              <button
                                type="button"
                                onClick={() => setAsMainImage(index)}
                                className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white hover:bg-green-700"
                                title="Als hoofdfoto"
                              >
                                <Star className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* Move down */}
                            {index < formData.images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => moveImage(index, index + 1)}
                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
                                title="Naar beneden"
                              >
                                <ChevronDown className="w-5 h-5" />
                              </button>
                            )}
                            
                            {/* Magische gum — alleen voor foto's op onze eigen storage */}
                            {url.includes('/api/images/') && (
                              <button
                                type="button"
                                onClick={() => setInpaintUrl(url)}
                                className="w-8 h-8 bg-fuchsia-600 rounded-full flex items-center justify-center text-white hover:bg-fuchsia-700"
                                title="Logo weggummen (gratis)"
                                data-testid={`inpaint-image-${index}`}
                              >
                                <Eraser className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700"
                              title="Verwijderen"
                              data-testid={`remove-image-${index}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400">
                      <Camera className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nog geen afbeeldingen</p>
                      <p className="text-xs mt-1">Upload of maak een foto</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visibility Settings */}
              {!isEditing && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Zichtbaarheid
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Wie kan deze motor zien?</Label>
                      <Select 
                        value={formData.visibility} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, visibility: v }))}
                      >
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

                    {formData.visibility === 'selected' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Selecteer dealers ({formData.visible_to_dealers.length})</Label>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={selectAllDealers}>
                              Alles
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={deselectAllDealers}>
                              Geen
                            </Button>
                          </div>
                        </div>
                        
                        {loadingDealers ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                          </div>
                        ) : dealers.length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2">Geen dealers gevonden</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                            {dealers.map((dealer) => (
                              <label
                                key={dealer.id}
                                className="flex items-center gap-3 p-2 hover:bg-zinc-50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={formData.visible_to_dealers.includes(dealer.id)}
                                  onCheckedChange={() => toggleDealerSelection(dealer.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-zinc-900 truncate">{dealer.company_name}</p>
                                  <p className="text-xs text-zinc-500 truncate">{dealer.email}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}

                        {formData.visible_to_dealers.length === 0 && (
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            ⚠️ Geen dealers geselecteerd!
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/admin/motorcycles')}
                  data-testid="cancel-btn"
                >
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={loading}
                  data-testid="save-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Opslaan...' : 'Opslaan'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* WhatsApp Share Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              Motor Toegevoegd!
            </DialogTitle>
            <DialogDescription>
              Wilt u alle 🇳🇱 Nederlandse dealers direct informeren via WhatsApp?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-800">
                📱 Met één klik opent WhatsApp voor elke Nederlandse dealer met een vooraf ingevuld bericht over deze motor.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  navigate('/admin/motorcycles');
                }}
              >
                Later
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  navigate(`/admin/whatsapp?motorcycle=${newMotorcycleId}`);
                }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Deel via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🧽 Manual inpaint editor */}
      <ManualInpaintModal
        open={!!inpaintUrl}
        onClose={() => setInpaintUrl(null)}
        imageUrl={inpaintUrl}
        onDone={(ts) => setInpaintCacheBust(prev => ({ ...prev, [inpaintUrl]: ts }))}
      />
    </Layout>
  );
};

export default MotorcycleForm;
