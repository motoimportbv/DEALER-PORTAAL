import React, { useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { UserPlus, Eye, EyeOff, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminCreateTaxateur = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    company_name: '',
    kvk_number: '',
    btw_number: '',
    address: '',
    phone: '',
    vehicle_type: 'auto',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.company_name) {
      toast.error('E-mail, wachtwoord en bedrijfsnaam zijn verplicht');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/admin/create-taxateur`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data?.message || `Taxateur aangemaakt voor ${formData.company_name}`);
      setFormData({
        email: '', password: '', username: '', company_name: '',
        kvk_number: '', btw_number: '', address: '', phone: '', vehicle_type: 'auto',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij aanmaken taxateur');
    } finally {
      setLoading(false);
    }
  };

  const fillDeniz = () => {
    setFormData({
      email: 'denizkabakolak10@hotmail.com',
      password: 'Kabakolakdeniz!',
      username: 'Denizkabakolak23',
      company_name: 'DK Automotive',
      kvk_number: '88479935',
      btw_number: 'NL004610985B39',
      address: 'Schotwillemsweg 1c, Lettele',
      phone: '',
      vehicle_type: 'auto',
    });
    toast.info('Deniz gegevens ingevuld — klik op "Aanmaken" om te bevestigen');
  };

  return (
    <Layout>
      <div className="content-header">
        <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-red-600" />
          Taxateur Account Aanmaken
        </h1>
        <p className="text-zinc-500 mt-1">Maak een nieuwe externe taxateur aan met eigen branding (KvK, BTW, adres). Toegang beperkt tot Taxatie Facturen + BPM Vermindering.</p>
      </div>

      <div className="content-body max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Nieuwe Taxateur</span>
              <Button type="button" variant="outline" size="sm" onClick={fillDeniz} data-testid="fill-deniz-btn">
                Vul Deniz gegevens
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" required value={formData.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="naam@bedrijf.nl" data-testid="taxateur-email" />
                </div>
                <div>
                  <Label htmlFor="password">Wachtwoord *</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} required
                      value={formData.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Min. 6 tekens" data-testid="taxateur-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="company_name">Bedrijfsnaam *</Label>
                <Input id="company_name" required value={formData.company_name}
                  onChange={(e) => update('company_name', e.target.value)}
                  placeholder="DK Automotive" data-testid="taxateur-company" />
              </div>

              <div>
                <Label htmlFor="username">Naam taxateur (gebruikersnaam)</Label>
                <Input id="username" value={formData.username}
                  onChange={(e) => update('username', e.target.value)}
                  placeholder="Bijv. D. Kabakolak — verschijnt in PDFs" data-testid="taxateur-username" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="kvk">KvK nummer</Label>
                  <Input id="kvk" value={formData.kvk_number}
                    onChange={(e) => update('kvk_number', e.target.value)}
                    placeholder="88479935" data-testid="taxateur-kvk" />
                </div>
                <div>
                  <Label htmlFor="btw">BTW nummer</Label>
                  <Input id="btw" value={formData.btw_number}
                    onChange={(e) => update('btw_number', e.target.value)}
                    placeholder="NL004610985B39" data-testid="taxateur-btw" />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Adres</Label>
                <Input id="address" value={formData.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Schotwillemsweg 1c, Lettele" data-testid="taxateur-address" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefoon (optioneel)</Label>
                  <Input id="phone" value={formData.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="+31 6 ..." data-testid="taxateur-phone" />
                </div>
                <div>
                  <Label htmlFor="vehicle_type">Voertuigtype</Label>
                  <select id="vehicle_type" value={formData.vehicle_type}
                    onChange={(e) => update('vehicle_type', e.target.value)}
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                    data-testid="taxateur-vehicle-type">
                    <option value="auto">Auto's</option>
                    <option value="motorfiets">Motorfietsen</option>
                  </select>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700"
                data-testid="create-taxateur-submit-btn">
                {loading ? 'Aanmaken...' : 'Taxateur Aanmaken'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminCreateTaxateur;
