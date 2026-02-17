import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { Bike } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AutoLoginPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams(); // Token from URL path /login/:token
  const [error, setError] = useState(null);
  const [attempting, setAttempting] = useState(true);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const performAutoLogin = async () => {
      // Get token from path OR query string
      const token = pathToken || searchParams.get('token');
      const redirect = searchParams.get('redirect') || '/dealer';

      console.log('[AutoLogin] Starting auto-login, token:', token ? 'present' : 'missing');

      if (!token) {
        console.log('[AutoLogin] No token provided');
        setError('Geen login token gevonden');
        setAttempting(false);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      try {
        console.log('[AutoLogin] Attempting auto-login...');
        
        // Try permanent login first, then notification login
        let response;
        try {
          response = await axios.post(`${API}/auth/permanent-login`, { token });
          console.log('[AutoLogin] Permanent login successful');
        } catch (permError) {
          // If permanent login fails, try notification login
          console.log('[AutoLogin] Trying notification login...');
          response = await axios.post(`${API}/auth/notification-login`, { token });
          console.log('[AutoLogin] Notification login successful');
        }
        
        if (response.data.token && response.data.user) {
          console.log('[AutoLogin] Got valid response, storing credentials...');
          
          // Clear any old data first
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Store the new token and user data
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Also set cookies for cross-context compatibility (PWA)
          const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
          document.cookie = `moto_token=${encodeURIComponent(response.data.token)}; expires=${expires}; path=/; SameSite=Lax`;
          document.cookie = `moto_user=${encodeURIComponent(JSON.stringify(response.data.user))}; expires=${expires}; path=/; SameSite=Lax`;
          
          // Set axios header
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          
          console.log('[AutoLogin] Success! Redirecting to:', redirect);
          
          // Force full page reload to ensure fresh auth state
          window.location.replace(redirect);
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err) {
        console.error('[AutoLogin] Failed:', err);
        
        const errorMsg = err.response?.data?.detail || 'Automatisch inloggen mislukt. De link is mogelijk verlopen.';
        setError(errorMsg);
        setAttempting(false);
        
        // Store the intended redirect for after manual login
        try {
          sessionStorage.setItem('redirectAfterLogin', redirect);
        } catch (e) {}
        
        // Redirect to login after showing error
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    };

    performAutoLogin();
  }, [searchParams, pathToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center p-8">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Bike className="w-8 h-8 text-white" />
        </div>
        
        {attempting && !error && (
          <>
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
              Even geduld...
            </h2>
            <p className="text-zinc-500">U wordt automatisch ingelogd</p>
          </>
        )}
        
        {error && (
          <>
            <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-red-600 mb-2">
              {error}
            </h2>
            <p className="text-zinc-500">U wordt doorgestuurd naar de login pagina...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AutoLoginPage;
