import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import WhatsAppButton from '../../components/WhatsAppButton';
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
  Trophy,
  Send,
  BarChart3,
  Eye,
  Target,
  Euro,
  Cloud,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topDealers, setTopDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversionData, setConversionData] = useState(null);
  const [marketingFiles, setMarketingFiles] = useState(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, topDealersRes, conversionRes, marketingRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/orders`),
        axios.get(`${API}/stats/top-dealers`).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/analytics/conversion`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/marketing-files`).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 5));
      setTopDealers(topDealersRes.data);
      setConversionData(conversionRes.data);
      setMarketingFiles(marketingRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateFiles = async () => {
    setMigrating(true);
    try {
      const response = await axios.post(`${API}/admin/marketing-files/migrate`);
      toast.success(`${response.data.summary.total_migrated} bestanden gemigreerd naar cloud`);
      // Refresh marketing files list
      const marketingRes = await axios.get(`${API}/admin/marketing-files`);
      setMarketingFiles(marketingRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Migratie mislukt');
    } finally {
      setMigrating(false);
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('nav.dashboard')}
            </h1>
            <p className="text-zinc-500 mt-1">{t('admin.portalOverview')}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/motorcycles/new">
              <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid="add-motorcycle-btn">
                <Plus className="w-5 h-5 mr-2" />
                {t('admin.newMotorcycle')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="admin-dashboard">
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
                  {topDealers.slice(0, 5).map((dealer, index) => {
                    // Check if dealer was active in last 5 minutes
                    const lastActive = dealer.last_active ? new Date(dealer.last_active) : null;
                    const now = new Date();
                    const isOnline = lastActive && (now - lastActive) < 5 * 60 * 1000; // 5 minutes
                    const isRecent = lastActive && (now - lastActive) < 60 * 60 * 1000; // 1 hour
                    
                    return (
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
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            {isOnline && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" title="Nu online"></span>
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${isOnline ? 'bg-green-500' : isRecent ? 'bg-blue-500' : 'bg-zinc-400'}`}>
                              {dealer.company_name?.charAt(0) || '?'}
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900">{dealer.company_name}</p>
                            <p className="text-sm text-zinc-500">{dealer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-barlow font-bold text-lg text-zinc-900">
                          {dealer.login_count || 0}
                        </span>
                        <span className="text-zinc-500 text-sm ml-1">{t('dealer.times')}</span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          {isOnline ? (
                            <span className="text-green-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Nu online
                            </span>
                          ) : lastActive ? (
                            <>
                              <span className={`font-medium ${isRecent ? 'text-blue-600' : 'text-zinc-600'}`}>
                                {new Date(dealer.last_active).toLocaleDateString('nl-NL', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {isRecent && <span className="text-xs text-blue-500">Recent actief</span>}
                            </>
                          ) : dealer.last_login ? (
                            <span className="text-zinc-500">
                              {new Date(dealer.last_login).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{t('dealer.neverLoggedIn')}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
