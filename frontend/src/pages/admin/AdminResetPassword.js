import React, { useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminResetPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
    new_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.new_password) {
      toast.error('Vul alle velden in');
      return;
    }

    if (formData.new_password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }

    setLoading(true);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/admin/reset-password`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(response.data);
      toast.success(`Wachtwoord gereset voor ${response.data.email}`);
      setFormData({ email: '', new_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij resetten wachtwoord');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="content-header">
        <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
          Wachtwoord Resetten
        </h1>
        <p className="text-zinc-500 mt-1">Reset het wachtwoord van een dealer</p>
      </div>

      <div className="content-body max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Wachtwoord Resetten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres van dealer *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="dealer@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">Nieuw wachtwoord *</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    placeholder="Minimaal 6 tekens"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Bezig...' : 'Wachtwoord Resetten'}
              </Button>
            </form>

            {success && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Wachtwoord gereset!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  {success.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminResetPassword;
