import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Bell, Bike, Check, CheckCheck, X, Trash2 } from 'lucide-react';
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

const NotificationBell = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  useEffect(() => {
    if (open && token) {
      fetchNotifications();
    }
  }, [open, token]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/notifications/unread-count`, getHeaders());
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`, getHeaders());
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`, {}, getHeaders());
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API}/notifications/${notificationId}`, getHeaders());
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await axios.delete(`${API}/notifications/all`, getHeaders());
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, getHeaders());
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Zojuist';
    if (minutes < 60) return `${minutes} min geleden`;
    if (hours < 24) return `${hours} uur geleden`;
    if (days < 7) return `${days} dagen geleden`;
    return date.toLocaleDateString('nl-NL');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-zinc-400 hover:text-white hover:bg-zinc-800"
          data-testid="notification-bell"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 bg-zinc-900 border-zinc-800 text-white"
        data-testid="notification-dropdown"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="font-barlow uppercase tracking-wide text-sm font-semibold">
            Meldingen
          </span>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-zinc-400 hover:text-white h-7"
                onClick={markAllAsRead}
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Gelezen
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-zinc-400 hover:text-red-400 h-7"
                onClick={deleteAllNotifications}
                data-testid="delete-all-notifications-btn"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Geen meldingen</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-3 py-3 border-b border-zinc-800 hover:bg-zinc-800 transition-colors ${
                  !notification.is_read ? 'bg-zinc-800/50' : ''
                }`}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'new_motorcycle' ? 'bg-red-600/20 text-red-500' : 'bg-blue-600/20 text-blue-500'
                  }`}>
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-white">
                        {notification.title}
                        {!notification.is_read && (
                          <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-zinc-500">
                        {formatTime(notification.created_at)}
                      </span>
                      <div className="flex gap-1">
                        {notification.motorcycle_id && (
                          <Link 
                            to={`/motorcycle/${notification.motorcycle_id}`}
                            onClick={() => {
                              if (!notification.is_read) markAsRead(notification.id);
                              setOpen(false);
                            }}
                          >
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 hover:text-red-400">
                              Bekijk
                            </Button>
                          </Link>
                        )}
                        {!notification.is_read && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-xs text-zinc-500 hover:text-white"
                            onClick={() => markAsRead(notification.id)}
                            title="Markeer als gelezen"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-xs text-zinc-500 hover:text-red-400"
                          onClick={() => deleteNotification(notification.id)}
                          title="Verwijder melding"
                          data-testid={`delete-notification-${notification.id}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
