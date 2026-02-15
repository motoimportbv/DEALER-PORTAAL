import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
      pending: 'In afwachting',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      completed: 'Voltooid'
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
              Dashboard
            </h1>
            <p className="text-zinc-500 mt-1">Overzicht van uw dealer portaal</p>
          </div>
          <Link to="/admin/motorcycles/new">
            <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid="add-motorcycle-btn">
              <Plus className="w-5 h-5 mr-2" />
              Nieuwe Motor
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body" data-testid="admin-dashboard">
        {/* Push Notifications Toggle for Admin */}
        <div className="mb-6">
          <PushNotificationToggle token={token} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="kpi-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                    Totaal Motoren
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

          <Card className="kpi-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                    Beschikbaar
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

          <Card className="kpi-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                    Openstaande Orders
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

          <Card className="kpi-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500 mb-1">
                    Dealers
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
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
                Recente Bestellingen
              </CardTitle>
              <Link to="/admin/orders">
                <Button variant="ghost" className="text-red-600 hover:text-red-700" data-testid="view-all-orders-btn">
                  Bekijk alle
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p className="text-zinc-500">Nog geen bestellingen</p>
              </div>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Dealer</th>
                    <th>Motor</th>
                    <th>Status</th>
                    <th>Datum</th>
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
                          <span className="text-zinc-400">Motor verwijderd</span>
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

        {/* Chat Section */}
        <div className="mt-8">
          <ChatWidget isAdmin={true} />
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
