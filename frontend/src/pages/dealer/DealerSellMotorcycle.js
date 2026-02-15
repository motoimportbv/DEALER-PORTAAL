import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Bike, ArrowLeft, Info } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerSellMotorcycle = () => {
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
    images: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        starting_price: formData.starting_price ? parseFloat(formData.starting_price) : parseFloat(formData.price) * 0.8,
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
              Motor Verkopen
            </h1>
            <p className="text-zinc-500 mt-1">Plaats uw motor te koop voor andere dealers</p>
          </div>
        </div>
      </div>

      <div className="content-body">
        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">Plaatsingskosten: €250</p>
            <p className="text-amber-700 text-sm">
              Bij verkoop van uw motor ontvangt u een factuur van €250. 
              Het plaatsen is gratis.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Bike className="w-5 h-5" />
              Motor Gegevens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="brand">Merk *</Label>
                  <Input
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="bijv. Kawasaki"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="bijv. Ninja ZX-6R"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Bouwjaar *</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={formData.year}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">Kilometerstand</Label>
                  <Input
                    id="mileage"
                    name="mileage"
                    type="number"
                    min="0"
                    value={formData.mileage}
                    onChange={handleChange}
                    placeholder="bijv. 15000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Kleur</Label>
                  <Input
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="bijv. Groen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Conditie</Label>
                  <select
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="new">Nieuw</option>
                    <option value="excellent">Uitstekend</option>
                    <option value="good">Goed</option>
                    <option value="fair">Redelijk</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Vraagprijs (€) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="bijv. 8500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starting_price">Minimum bod (€)</Label>
                  <Input
                    id="starting_price"
                    name="starting_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.starting_price}
                    onChange={handleChange}
                    placeholder="Optioneel - standaard 80% van vraagprijs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Beschrijf de motor, eventuele opties, onderhoud, etc."
                  rows={4}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Foto's</Label>
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
                      {uploadingImage ? 'Uploaden...' : 'Klik om foto\'s te uploaden'}
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
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Motor Plaatsen'
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
