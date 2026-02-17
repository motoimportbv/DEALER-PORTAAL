import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Set axios timeout to prevent infinite loading
axios.defaults.timeout = 15000;

// Helper function to safely get initial user from localStorage
const getInitialUser = () => {
  try {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }
  } catch (e) {
    console.error('Failed to parse cached user');
  }
  return null;
};

// Helper function to get initial token
const getInitialToken = () => {
  return localStorage.getItem('token');
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
      // Update cache with fresh data
      localStorage.setItem('user', JSON.stringify(response.data));
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
        // Only try to restore from cache if user is somehow null
        if (!user) {
          const cachedUser = localStorage.getItem('user');
          if (cachedUser) {
            try {
              setUser(JSON.parse(cachedUser));
            } catch (e) {
              // Invalid cached data
            }
          }
        }
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
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
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
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
