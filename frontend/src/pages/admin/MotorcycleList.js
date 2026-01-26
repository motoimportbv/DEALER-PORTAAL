import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Bike,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MotorcycleList = () => {
  const [motorcycles, setMotorcycles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMotorcycles();
  }, []);

  const fetchMotorcycles = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles`);
      setMotorcycles(response.data);
    } catch (error) {
      toast.error('Kon motorfietsen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/motorcycles/${id}`);
      toast.success('Motor verwijderd');
      fetchMotorcycles();
    } catch (error) {
      toast.error('Kon motor niet verwijderen');
    }
  };

  const getConditionBadge = (condition) => {
    const styles = {
      new: 'bg-emerald-100 text-emerald-800',
      excellent: 'bg-blue-100 text-blue-800',
      good: 'bg-amber-100 text-amber-800',
      fair: 'bg-zinc-100 text-zinc-800'
    };
    const labels = {
      new: 'Nieuw',
      excellent: 'Uitstekend',
      good: 'Goed',
      fair: 'Redelijk'
    };
    return <Badge className={styles[condition]}>{labels[condition]}</Badge>;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              Motorfietsen
            </h1>
            <p className="text-zinc-500 mt-1">{motorcycles.length} motoren in voorraad</p>
          </div>
          <Link to="/admin/motorcycles/new">
            <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid="add-motorcycle-btn">
              <Plus className="w-5 h-5 mr-2" />
              Nieuwe Motor
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body" data-testid="motorcycle-list">
        {motorcycles.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  Geen motoren gevonden
                </h3>
                <p className="text-zinc-500 mb-6">Voeg uw eerste motor toe om te beginnen</p>
                <Link to="/admin/motorcycles/new">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-5 h-5 mr-2" />
                    Eerste Motor Toevoegen
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {motorcycles.map((motorcycle) => (
              <Card key={motorcycle.id} className="motorcycle-card overflow-hidden" data-testid={`motorcycle-card-${motorcycle.id}`}>
                <div className="aspect-[4/3] relative bg-zinc-100">
                  {motorcycle.images?.[0] ? (
                    <img 
                      src={motorcycle.images[0]} 
                      alt={`${motorcycle.brand} ${motorcycle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bike className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                  {!motorcycle.is_available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge className="bg-red-600 text-white text-sm">Niet Beschikbaar</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                        {motorcycle.brand}
                      </h3>
                      <p className="text-zinc-600">{motorcycle.model}</p>
                    </div>
                    {getConditionBadge(motorcycle.condition)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                    <span>{motorcycle.year}</span>
                    <span>•</span>
                    <span>{motorcycle.mileage.toLocaleString('nl-NL')} km</span>
                  </div>

                  <p className="font-barlow text-2xl font-bold text-red-600 mb-4">
                    {formatPrice(motorcycle.price)}
                  </p>

                  <div className="flex gap-2">
                    <Link to={`/motorcycle/${motorcycle.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" data-testid={`view-btn-${motorcycle.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        Bekijk
                      </Button>
                    </Link>
                    <Link to={`/admin/motorcycles/${motorcycle.id}/edit`}>
                      <Button variant="outline" size="icon" data-testid={`edit-btn-${motorcycle.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700" data-testid={`delete-btn-${motorcycle.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Motor verwijderen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Weet u zeker dat u deze {motorcycle.brand} {motorcycle.model} wilt verwijderen? 
                            Dit kan niet ongedaan worden gemaakt.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuleren</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(motorcycle.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Verwijderen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

export default MotorcycleList;
