import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Eye, TrendingUp, Users, Calendar, Bike } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminActivity = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/activity-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch activity stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    
    if (diffMinutes < 1) return 'Zojuist';
    if (diffMinutes < 60) return `${diffMinutes} min geleden`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} uur geleden`;
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="admin-activity-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Dealer Activiteit</h1>
        <Badge variant="outline" className="text-sm">
          <Calendar className="w-4 h-4 mr-1" />
          Live data
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Views Vandaag</p>
                <p className="text-2xl font-bold text-zinc-900">{stats?.views_today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Views Deze Week</p>
                <p className="text-2xl font-bold text-zinc-900">{stats?.views_week || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bike className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Meest Bekeken</p>
                <p className="text-lg font-bold text-zinc-900 truncate">
                  {stats?.top_motorcycles?.[0]?.brand || '-'} {stats?.top_motorcycles?.[0]?.model || ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Meest Actieve Dealer</p>
                <p className="text-lg font-bold text-zinc-900 truncate">
                  {stats?.top_dealers?.[0]?.dealer_name || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Motorcycles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bike className="w-5 h-5 text-red-600" />
              Meest Bekeken Motoren (7 dagen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.top_motorcycles?.length > 0 ? (
              <div className="space-y-3">
                {stats.top_motorcycles.map((moto, index) => (
                  <div key={moto._id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{moto.brand} {moto.model}</span>
                    </div>
                    <Badge variant="secondary">{moto.views} views</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">Nog geen data beschikbaar</p>
            )}
          </CardContent>
        </Card>

        {/* Top Dealers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Meest Actieve Dealers (7 dagen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.top_dealers?.length > 0 ? (
              <div className="space-y-3">
                {stats.top_dealers.map((dealer, index) => (
                  <div key={dealer._id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{dealer.dealer_name}</span>
                    </div>
                    <Badge variant="secondary">{dealer.views} views</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">Nog geen data beschikbaar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-600" />
            Recente Activiteit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_activity?.length > 0 ? (
            <div className="space-y-2">
              {stats.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <div>
                      <span className="font-medium">{activity.dealer_name}</span>
                      <span className="text-zinc-500"> heeft </span>
                      <span className="font-medium text-red-600">{activity.motorcycle_brand} {activity.motorcycle_model}</span>
                      <span className="text-zinc-500"> bekeken</span>
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400">{formatTime(activity.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-4">Nog geen recente activiteit</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivity;
