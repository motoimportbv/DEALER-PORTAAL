import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Bike, Plus, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerMyListings = () => {
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings(response.data);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (motorcycle) => {
    if (motorcycle.is_available) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Te Koop
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Verkocht
        </Badge>
      );
    }
  };

  const getConditionLabel = (condition) => {
    const labels = {
      new: 'Nieuw',
      excellent: 'Uitstekend',
      good: 'Goed',
      fair: 'Redelijk'
    };
    return labels[condition] || condition;
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              Mijn Motoren
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} motor{listings.length !== 1 ? 'en' : ''} geplaatst
            </p>
          </div>
          <Link to="/dealer/sell">
            <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide">
              <Plus className="w-5 h-5 mr-2" />
              Motor Verkopen
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body">
        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  Nog geen motoren geplaatst
                </h3>
                <p className="text-zinc-500 mb-6">
                  Plaats uw eerste motor te koop voor andere dealers
                </p>
                <Link to="/dealer/sell">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Motor Verkopen
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((motorcycle) => (
              <Card key={motorcycle.id} className="overflow-hidden">
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
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(motorcycle)}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="mb-2">
                    <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                      {motorcycle.brand}
                    </h3>
                    <p className="text-zinc-600">{motorcycle.model}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                    <span>{motorcycle.year}</span>
                    <span>•</span>
                    <span>{motorcycle.mileage?.toLocaleString('nl-NL')} km</span>
                    <span>•</span>
                    <span>{getConditionLabel(motorcycle.condition)}</span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-zinc-500">Vraagprijs</span>
                    <span className="font-barlow text-xl font-bold text-red-600">
                      {formatPrice(motorcycle.price)}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400">
                    Geplaatst op {new Date(motorcycle.created_at).toLocaleDateString('nl-NL')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info about fees */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            <strong>Let op:</strong> Bij verkoop van uw motor ontvangt u een factuur van €250 voor de plaatsingskosten.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default DealerMyListings;
