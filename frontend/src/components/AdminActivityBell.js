import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Activity, Eye, ShoppingCart, Check, Trash2, User } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminActivityBell = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  useEffect(() => {
    if (open && token && user?.role === 'admin') {
      fetchNotifications();
    }
  }, [open, token, user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/admin/activity-notifications/unread-count`, getHeaders());
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch admin unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/admin/activity-notifications`, getHeaders());
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch admin notifications:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/admin/activity-notifications/read-all`, {}, getHeaders());
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteAll = async () => {
    try {
      await axios.delete(`${API}/admin/activity-notifications/all`, getHeaders());
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all:', error);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'dealer_view':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'order':
        return <ShoppingCart className="w-4 h-4 text-green-500" />;
      case 'login':
        return <User className="w-4 h-4 text-purple-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    
    if (diffMinutes < 1) return 'Zojuist';
    if (diffMinutes < 60) return `${diffMinutes} min geleden`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} uur geleden`;
    return date.toLocaleDateString('nl-NL');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="admin-activity-bell">
          <Activity className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-blue-600 text-white text-xs"
              data-testid="admin-activity-badge"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Dealer Activiteit</span>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2">
                <Check className="h-3 w-3 mr-1" />
                Gelezen
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={deleteAll} className="h-7 px-2 text-red-500 hover:text-red-700">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Geen recente activiteit
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.is_read ? 'bg-blue-50' : ''}`}
                asChild
              >
                <Link to={notification.motorcycle_id ? `/admin/motorcycles/${notification.motorcycle_id}` : '#'}>
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/admin/activity" className="flex items-center justify-center py-2 text-sm text-blue-600 hover:text-blue-800">
            Bekijk alle activiteit
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdminActivityBell;
