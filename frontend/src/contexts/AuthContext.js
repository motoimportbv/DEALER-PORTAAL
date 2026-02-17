import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Set axios timeout to prevent infinite loading
axios.defaults.timeout = 15000;

// Cookie helper functions - gebruik meerdere methodes voor maximale compatibiliteit
const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // Probeer meerdere cookie configuraties voor verschillende browsers/PWAs
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  // Backup cookie met andere settings
  document.cookie = `${name}_backup=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  // Probeer eerst de hoofdcookie
  let parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = decodeURIComponent(parts.pop().split(';').shift());
    if (cookieValue) return cookieValue;
  }
  // Probeer de backup cookie
  parts = value.split(`; ${name}_backup=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(';').shift());
  }
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${name}_backup=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

// Helper function to safely get initial user from localStorage or cookie
const getInitialUser = () => {
  try {
    // First try localStorage
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      if (parsed && parsed.id) return parsed;
    }
  } catch (e) {
    console.error('[Auth] Failed to parse localStorage user');
  }
  
  try {
    // Then try cookie
    const cookieUser = getCookie('moto_user');
    if (cookieUser) {
      const parsed = JSON.parse(cookieUser);
      if (parsed && parsed.id) {
        // Sync cookie to localStorage
        try { localStorage.setItem('user', cookieUser); } catch(e) {}
        return parsed;
      }
    }
  } catch (e) {
    console.error('[Auth] Failed to parse cookie user');
  }
  
  try {
    // Try sessionStorage as last resort
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      const parsed = JSON.parse(sessionUser);
      if (parsed && parsed.id) return parsed;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
};

// Helper function to get initial token from localStorage or cookie
const getInitialToken = () => {
  // First try localStorage
  try {
    const localToken = localStorage.getItem('token');
    if (localToken && localToken.length > 20) {
      return localToken;
    }
  } catch (e) {
    console.error('[Auth] Failed to read localStorage token');
  }
  
  // Then try cookie
  try {
    const cookieToken = getCookie('moto_token');
    if (cookieToken && cookieToken.length > 20) {
      // Sync cookie token to localStorage for future use
      try { localStorage.setItem('token', cookieToken); } catch (e) {}
      return cookieToken;
    }
  } catch (e) {
    console.error('[Auth] Failed to read cookie token');
  }
  
  // Try sessionStorage as last resort
  try {
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken && sessionToken.length > 20) {
      return sessionToken;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
};

// Sla credentials op in ALLE beschikbare storage methodes
const persistCredentials = (token, user) => {
  const userStr = JSON.stringify(user);
  
  // localStorage
  try {
    localStorage.setItem('token', token);
    localStorage.setItem('user', userStr);
  } catch (e) {
    console.warn('[Auth] localStorage not available');
  }
  
  // sessionStorage
  try {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', userStr);
  } catch (e) {
    console.warn('[Auth] sessionStorage not available');
  }
  
  // Cookies (met lange expiry)
  setCookie('moto_token', token, 365);
  setCookie('moto_user', userStr, 365);
};

// Verwijder credentials uit ALLE storage methodes
const clearCredentials = () => {
  try { localStorage.removeItem('token'); } catch (e) {}
  try { localStorage.removeItem('user'); } catch (e) {}
  try { sessionStorage.removeItem('token'); } catch (e) {}
  try { sessionStorage.removeItem('user'); } catch (e) {}
  deleteCookie('moto_token');
  deleteCookie('moto_user');
};

export const AuthProvider = ({ children }) => {
  // Initialize user SYNCHRONOUSLY from localStorage to prevent flash of login page
  const [user, setUser] = useState(() => getInitialUser());
  const [token, setToken] = useState(() => getInitialToken());
  // If we have both token and user in localStorage, don't show loading
  const [loading, setLoading] = useState(() => {
    const hasToken = !!getInitialToken();
    const hasUser = !!getInitialUser();
    // Only show loading if we have a token but no cached user
    return hasToken && !hasUser;
  });
  const [error, setError] = useState(null);

  // Set axios header immediately if token exists
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        // Fetch fresh data from server (user is already set from localStorage)
        await fetchUser();
      } else {
        setLoading(false);
      }
    };
    
    initAuth();
  }, [token]);

  // Ververs user data wanneer de app weer zichtbaar wordt (bijv. na wisselen van app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token) {
        // App is weer zichtbaar, ververs data
        fetchUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token]);

  const fetchUser = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API}/auth/me`);
      // Always use fresh data from server
      setUser(response.data);
      // Update cache in ALL storage locations
      persistCredentials(token, response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      
      // Only logout if token is truly invalid (401/403), not on network errors
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        setError('Sessie verlopen, log opnieuw in');
        logout();
      } else {
        // Network error or server issue - keep user logged in with cached data
        setError('Verbinding mislukt, probeer opnieuw');
        // Don't touch user state - keep whatever is already set from cache
      }
    } finally {
      // Always set loading to false, even on error
      setLoading(false);
    }
  };

  // Function to refresh user data (can be called manually)
  const refreshUser = async () => {
    if (token) {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
        persistCredentials(token, response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to refresh user:', error);
        logout();
      }
    }
    return null;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    // Store in ALL storage locations for maximum compatibility
    persistCredentials(newToken, userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    // Ensure we use fresh user data with correct is_approved status
    setUser(userData);
    return userData;
  };

  const register = async (email, password, companyName, role = 'dealer', kvkNumber = '', address = '', postalCode = '', city = '', phone = '', contactPerson = '') => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      company_name: companyName,
      role,
      kvk_number: kvkNumber,
      address,
      postal_code: postalCode,
      city,
      phone,
      contact_person: contactPerson
    });
    const { token: newToken, user: userData } = response.data;
    // Store in ALL storage locations for maximum compatibility
    persistCredentials(newToken, userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    // Clear ALL storage locations
    clearCredentials();
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
