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
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Save, Plus, X, ImageIcon, Camera, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Alle motormerken - alfabetisch gesorteerd
const MOTORCYCLE_BRANDS = [
  'Aprilia', 'Benelli', 'Beta', 'Bimota', 'BMW', 'Brixton', 'Buell', 'Bultaco',
  'Cagiva', 'Can-Am', 'CCM', 'CF Moto', 'Condor',
  'Ducati',
  'Energica',
  'Fantic',
  'Gas Gas', 'Gilera', 'Gowow',
  'Harley-Davidson', 'Hercules', 'Honda', 'Horex', 'Husqvarna', 'Hyosung',
  'Indian', 'Italjet',
  'Jawa',
  'Kawasaki', 'Kramer', 'KTM', 'Kymco',
  'Laverda', 'Lambretta', 'Leonart',
  'Mash', 'Miele', 'Montesa', 'Morbidelli', 'Moto Guzzi', 'Moto Morini', 'Motobecane', 'Mutt Motorcycles', 'MV Agusta', 'MZ',
  'Norton',
  'Orcal',
  'Peugeot', 'Piaggio', 'Polaris',
  'Rieju', 'Royal Enfield',
  'Sachs', 'Sherco', 'SWM', 'Suzuki', 'SYM',
  'Triumph', 'TRS', 'TM Racing',
  'Ultraviolette',
  'Vent', 'Vespa', 'Victory', 'Voge',
  'Yamaha',
  'Zero', 'Zontes', 'Zundapp'
].sort();

const MotorcycleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

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
    is_available: true
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      fetchMotorcycle();
    }
  }, [id]);

  const fetchMotorcycle = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/${id}`);
      setFormData(response.data);
    } catch (error) {
      toast.error('Kon motor niet laden');
      navigate('/admin/motorcycles');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        const response = await axios.post(`${API}/upload`, formDataUpload, {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        starting_price: parseFloat(formData.price), // Same as price - no auction
        mileage: parseInt(formData.mileage),
        year: parseInt(formData.year)
      };

      if (isEditing) {
        await axios.put(`${API}/motorcycles/${id}`, payload);
        toast.success('Motor bijgewerkt');
      } else {
        await axios.post(`${API}/motorcycles`, payload);
        toast.success('Motor toegevoegd');
      }
      navigate('/admin/motorcycles');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Er ging iets mis');
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Merk *
                    </Label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => handleChange('brand', e.target.value)}
                      placeholder="bijv. Ducati"
                      data-testid="brand-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Model *
                    </Label>
                    <Input
                      value={formData.model}
                      onChange={(e) => handleChange('model', e.target.value)}
                      placeholder="bijv. Panigale V4"
                      data-testid="model-input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Bouwjaar *
                    </Label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleChange('year', e.target.value)}
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      data-testid="year-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Prijs (€) *
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
                  </div>
                </div>

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
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100">
                          <img src={url} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700"
                            data-testid={`remove-image-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
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
    </Layout>
  );
};

export default MotorcycleForm;
