import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Bike, Plus, Clock, CheckCircle, Globe } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ForeignDealerDashboard = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/foreign-listings`, {
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
    if (motorcycle.is_pending_approval) {
      return (
        <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {t('foreignDealer.pendingReview')}
        </Badge>
      );
    } else if (motorcycle.is_available) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {t('motorcycle.available')}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          {t('motorcycle.sold')}
        </Badge>
      );
    }
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
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="content-header">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-6 h-6 text-purple-600" />
              <Badge className="bg-purple-100 text-purple-800">{t('foreignDealer.title')}</Badge>
            </div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('foreignDealer.myListings')}
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} {listings.length !== 1 ? 'motors' : 'motor'}
            </p>
          </div>
          <Link to="/foreign-dealer/add">
            <Button className="bg-purple-600 hover:bg-purple-700 font-barlow uppercase tracking-wide">
              <Plus className="w-5 h-5 mr-2" />
              {t('foreignDealer.addMotorcycle')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body">
        {/* Info Banner */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <p className="text-purple-800 text-sm">
            {t('foreignDealer.infoMessage')}
          </p>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('motorcycle.addMotorcycle')}
                </h3>
                <p className="text-zinc-500 mb-6">
                  {t('foreignDealer.infoMessage')}
                </p>
                <Link to="/foreign-dealer/add">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('foreignDealer.addMotorcycle')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((motorcycle) => (
              <Card key={motorcycle.id} className="overflow-hidden border-purple-200">
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
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-500">
                      {motorcycle.is_pending_approval ? 'Voorgestelde prijs' : t('motorcycle.price')}
                    </span>
                    <span className={`font-barlow text-xl font-bold ${motorcycle.is_pending_approval ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatPrice(motorcycle.price)}
                    </span>
                  </div>

                  {motorcycle.original_price && motorcycle.original_price !== motorcycle.price && (
                    <div className="text-xs text-zinc-400">
                      Origineel: {formatPrice(motorcycle.original_price)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ForeignDealerDashboard;
