import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import WhatsAppButton from '../../components/WhatsAppButton';
import PushNotificationToggle from '../../components/PushNotificationToggle';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Bike, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  Plus,
  ArrowRight,
  Package,
  Trophy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topDealers, setTopDealers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, topDealersRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/orders`),
        axios.get(`${API}/stats/top-dealers`).catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 5));
      setTopDealers(topDealersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    const labels = {
      pending: t('order.pending'),
      approved: t('order.approved'),
      rejected: t('order.rejected'),
      completed: t('order.completed')
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
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
              {t('nav.dashboard')}
            </h1>
            <p className="text-zinc-500 mt-1">{t('admin.portalOverview')}</p>
          </div>
          <Link to="/admin/motorcycles/new">
            <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid="add-motorcycle-btn">
              <Plus className="w-5 h-5 mr-2" />
              {t('admin.newMotorcycle')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body" data-testid="admin-dashboard">
        {/* Push Notifications Toggle for Admin */}
        <div className="mb-6">
          <PushNotificationToggle token={token} />
        </div>

        {/* Stats Grid - Clickable KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/admin/motorcycles" className="block">
            <Card className="kpi-card hover:shadow-lg hover:border-red-200 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                      {t('admin.totalMotorcycles')}
                    </p>
                    <p className="font-barlow text-4xl font-bold text-zinc-900">
                      {stats?.total_motorcycles || 0}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                    <Bike className="w-7 h-7 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/motorcycles" className="block">
            <Card className="kpi-card hover:shadow-lg hover:border-green-200 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                      {t('motorcycle.available')}
                    </p>
                    <p className="font-barlow text-4xl font-bold text-zinc-900">
                      {stats?.available_motorcycles || 0}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/orders" className="block">
            <Card className="kpi-card hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                      {t('admin.pendingOrders')}
                    </p>
                    <p className="font-barlow text-4xl font-bold text-zinc-900">
                      {stats?.pending_orders || 0}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-7 h-7 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/dealers" className="block">
            <Card className="kpi-card hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                      {t('nav.dealers')}
                    </p>
                    <p className="font-barlow text-4xl font-bold text-zinc-900">
                      {stats?.total_dealers || 0}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
                {t('admin.recentOrders')}
              </CardTitle>
              <Link to="/admin/orders">
                <Button variant="ghost" className="text-red-600 hover:text-red-700" data-testid="view-all-orders-btn">
                  {t('admin.viewAll')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p className="text-zinc-500">{t('order.noOrders')}</p>
              </div>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>{t('nav.dealers')}</th>
                    <th>{t('motorcycle.singular')}</th>
                    <th>{t('order.status')}</th>
                    <th>{t('order.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} data-testid={`order-row-${order.id}`}>
                      <td>
                        <div>
                          <p className="font-semibold text-zinc-900">{order.dealer_company}</p>
                          <p className="text-sm text-zinc-500">{order.dealer_email}</p>
                        </div>
                      </td>
                      <td>
                        {order.motorcycle ? (
                          <span className="font-medium">
                            {order.motorcycle.brand} {order.motorcycle.model}
                          </span>
                        ) : (
                          <span className="text-zinc-400">{t('motorcycle.deleted')}</span>
                        )}
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td className="text-zinc-500">
                        {new Date(order.created_at).toLocaleDateString('nl-NL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top Dealers Section */}
        <Card className="mt-8">
          <CardHeader className="border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                {t('dealer.topDealers')}
              </CardTitle>
              <Link to="/admin/dealers">
                <Button variant="ghost" className="text-red-600 hover:text-red-700" data-testid="view-all-dealers-btn">
                  {t('admin.allDealers')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topDealers.length === 0 ? (
              <div className="empty-state py-8">
                <Users className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p className="text-zinc-500">{t('dealer.noActivity')}</p>
              </div>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('nav.dealers')}</th>
                    <th>{t('dealer.loginCount')}</th>
                    <th>{t('dealer.lastActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topDealers.slice(0, 5).map((dealer, index) => (
                    <tr key={dealer.id} data-testid={`top-dealer-row-${dealer.id}`}>
                      <td>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-zinc-200 text-zinc-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-zinc-900">{dealer.company_name}</p>
                          <p className="text-sm text-zinc-500">{dealer.email}</p>
                        </div>
                      </td>
                      <td>
                        <span className="font-barlow font-bold text-lg text-zinc-900">
                          {dealer.login_count || 0}
                        </span>
                        <span className="text-zinc-500 text-sm ml-1">{t('dealer.times')}</span>
                      </td>
                      <td className="text-zinc-500">
                        {dealer.last_login 
                          ? new Date(dealer.last_login).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : t('dealer.neverLoggedIn')
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Button */}
        <WhatsAppButton />
      </div>
    </Layout>
  );
};

export default AdminDashboard;
