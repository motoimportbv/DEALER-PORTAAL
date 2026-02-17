import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Set axios timeout to prevent infinite loading
axios.defaults.timeout = 15000;

// ============ IndexedDB Storage (meest persistent op iOS) ============
const DB_NAME = 'MotoImportAuth';
const STORE_NAME = 'auth';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const idbGet = async (key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (e) {
    console.warn('[Auth] IndexedDB get failed:', e);
    return null;
  }
};

const idbSet = async (key, value) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.warn('[Auth] IndexedDB set failed:', e);
  }
};

const idbDelete = async (key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.warn('[Auth] IndexedDB delete failed:', e);
  }
};

// ============ Cookie Storage (backup) ============
const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(';').shift());
  }
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

// ============ Combined Storage Functions ============
// Probeert alle storage methodes en geeft de eerste geldige waarde terug
const getStoredValue = async (key) => {
  // 1. Probeer IndexedDB eerst (meest persistent)
  try {
    const idbValue = await idbGet(key);
    if (idbValue) {
      console.log(`[Auth] Got ${key} from IndexedDB`);
      return idbValue;
    }
  } catch (e) {}
  
  // 2. Probeer localStorage
  try {
    const localValue = localStorage.getItem(key);
    if (localValue) {
      console.log(`[Auth] Got ${key} from localStorage`);
      return localValue;
    }
  } catch (e) {}
  
  // 3. Probeer cookie
  try {
    const cookieValue = getCookie(`moto_${key}`);
    if (cookieValue) {
      console.log(`[Auth] Got ${key} from cookie`);
      return cookieValue;
    }
  } catch (e) {}
  
  return null;
};

// Slaat waarde op in ALLE storage methodes
const setStoredValue = async (key, value) => {
  // IndexedDB
  await idbSet(key, value);
  
  // localStorage
  try { localStorage.setItem(key, value); } catch (e) {}
  
  // Cookie
  setCookie(`moto_${key}`, value, 365);
};

// Verwijdert waarde uit ALLE storage methodes
const deleteStoredValue = async (key) => {
  await idbDelete(key);
  try { localStorage.removeItem(key); } catch (e) {}
  deleteCookie(`moto_${key}`);
};

// ============ Synchrone initialisatie (voor eerste render) ============
const getInitialUserSync = () => {
  // Alleen localStorage en cookies checken (IndexedDB is async)
  try {
    const localUser = localStorage.getItem('user');
    if (localUser) return JSON.parse(localUser);
  } catch (e) {}
  
  try {
    const cookieUser = getCookie('moto_user');
    if (cookieUser) return JSON.parse(cookieUser);
  } catch (e) {}
  
  return null;
};

const getInitialTokenSync = () => {
  try {
    const localToken = localStorage.getItem('token');
    if (localToken && localToken.length > 20) return localToken;
  } catch (e) {}
  
  try {
    const cookieToken = getCookie('moto_token');
    if (cookieToken && cookieToken.length > 20) return cookieToken;
  } catch (e) {}
  
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getInitialUserSync());
  const [token, setToken] = useState(() => getInitialTokenSync());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check IndexedDB voor auth data bij startup (async)
  useEffect(() => {
    const checkIndexedDB = async () => {
      // Als we al een token hebben, geen IDB check nodig
      if (token) {
        setLoading(false);
        return;
      }
      
      console.log('[Auth] Checking IndexedDB for stored credentials...');
      
      try {
        const storedToken = await getStoredValue('token');
        const storedUser = await getStoredValue('user');
        
        if (storedToken && storedUser) {
          console.log('[Auth] Found credentials in IndexedDB!');
          const parsedUser = typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser;
          
          setToken(storedToken);
          setUser(parsedUser);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Sync naar andere storage methodes
          await setStoredValue('token', storedToken);
          await setStoredValue('user', typeof storedUser === 'string' ? storedUser : JSON.stringify(storedUser));
        }
      } catch (e) {
        console.error('[Auth] IndexedDB check failed:', e);
      }
      
      setLoading(false);
    };
    
    checkIndexedDB();
  }, []);

  // Set axios header wanneer token verandert
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verifieer token bij de server
      fetchUser();
    }
  }, [token]);

  // Ververs user data wanneer app weer zichtbaar wordt
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Auth] App visible, checking auth...');
        
        // Check IndexedDB opnieuw wanneer app terugkomt
        if (!token) {
          const storedToken = await getStoredValue('token');
          const storedUser = await getStoredValue('user');
          
          if (storedToken && storedUser) {
            console.log('[Auth] Restored credentials from storage');
            const parsedUser = typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser;
            setToken(storedToken);
            setUser(parsedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          }
        } else {
          // Token bestaat, ververs user data
          fetchUser();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token]);

  const fetchUser = async () => {
    if (!token) return;
    
    try {
      setError(null);
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      // Update alle storage
      await setStoredValue('user', JSON.stringify(response.data));
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error);
      
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        setError('Sessie verlopen, log opnieuw in');
        logout();
      } else {
        setError('Verbinding mislukt');
      }
    }
  };

  const refreshUser = async () => {
    await fetchUser();
    return user;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    
    // Sla op in ALLE storage methodes
    await setStoredValue('token', newToken);
    await setStoredValue('user', JSON.stringify(userData));
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    
    console.log('[Auth] Login successful, credentials stored in all locations');
    return userData;
  };

  const register = async (email, password, companyName, role = 'dealer', kvkNumber = '', address = '', postalCode = '', city = '', phone = '', contactPerson = '') => {
    const response = await axios.post(`${API}/auth/register`, {
      email, password, company_name: companyName, role,
      kvk_number: kvkNumber, address, postal_code: postalCode,
      city, phone, contact_person: contactPerson
    });
    const { token: newToken, user: userData } = response.data;
    
    await setStoredValue('token', newToken);
    await setStoredValue('user', JSON.stringify(userData));
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await deleteStoredValue('token');
    await deleteStoredValue('user');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
