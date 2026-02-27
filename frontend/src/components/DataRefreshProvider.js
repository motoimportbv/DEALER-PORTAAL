import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Context voor globale data refresh events
const DataRefreshContext = createContext(null);

export const useDataRefresh = () => {
  const context = useContext(DataRefreshContext);
  if (!context) {
    throw new Error('useDataRefresh must be used within DataRefreshProvider');
  }
  return context;
};

export const DataRefreshProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Track of het de eerste check is (geen toast bij initiële load)
  const isFirstCheck = useRef(true);
  // Bewaar laatste count in ref om stale closure issues te voorkomen
  const lastCountRef = useRef(null);
  
  // Trigger een refresh voor alle luisterende componenten
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Check voor updates elke 30 seconden
  useEffect(() => {
    if (!token || !user) return;

    const checkForUpdates = async () => {
      try {
        // Check voor nieuwe notificaties
        const response = await axios.get(`${API}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const newCount = response.data.count || 0;
        
        // Bij eerste check: sla alleen de count op, geen toast
        if (isFirstCheck.current) {
          isFirstCheck.current = false;
          lastCountRef.current = newCount;
          sessionStorage.setItem('lastNotificationCount', newCount.toString());
          setLastCheck(Date.now());
          return;
        }
        
        // Haal vorige count op (gebruik ref of sessionStorage als fallback)
        const lastCount = lastCountRef.current !== null 
          ? lastCountRef.current 
          : parseInt(sessionStorage.getItem('lastNotificationCount') || newCount.toString());
        
        // Alleen toast tonen als er ECHT nieuwe notificaties zijn
        if (newCount > lastCount) {
          const diff = newCount - lastCount;
          
          // Toon toast
          toast.info(
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span>{diff === 1 ? 'Nieuwe melding!' : `${diff} nieuwe meldingen!`}</span>
            </div>,
            {
              description: 'Klik op de bel om te bekijken',
              duration: 5000,
            }
          );
          
          // Trigger data refresh voor alle componenten
          triggerRefresh();
        }
        
        // Update stored count
        lastCountRef.current = newCount;
        sessionStorage.setItem('lastNotificationCount', newCount.toString());
        setLastCheck(Date.now());
        
      } catch (error) {
        // Stille fout - niet storend voor gebruiker
        console.error('Failed to check for updates:', error);
      }
    };

    // Initial check
    checkForUpdates();
    
    // Interval voor polling
    const interval = setInterval(checkForUpdates, 30000); // 30 seconden
    
    return () => clearInterval(interval);
  }, [token, user, triggerRefresh]);

  // Luister naar visibility changes - ververs wanneer tab weer actief wordt
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab is weer actief, trigger refresh
        triggerRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [triggerRefresh]);

  return (
    <DataRefreshContext.Provider value={{ refreshTrigger, triggerRefresh, lastCheck }}>
      {children}
    </DataRefreshContext.Provider>
  );
};

// Custom hook om data te refreshen wanneer er updates zijn
export const useAutoRefresh = (fetchFunction, dependencies = []) => {
  const { refreshTrigger } = useDataRefresh();
  
  useEffect(() => {
    if (fetchFunction) {
      fetchFunction();
    }
  }, [refreshTrigger, ...dependencies]);
};

export default DataRefreshProvider;
