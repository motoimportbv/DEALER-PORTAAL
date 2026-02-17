import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Bike } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AutoLoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [attempting, setAttempting] = useState(true);

  useEffect(() => {
    const performAutoLogin = async () => {
      const token = searchParams.get('token');
      const redirect = searchParams.get('redirect') || '/dealer';

      // If already logged in, just redirect
      if (user) {
        console.log('[AutoLogin] Already logged in, redirecting to:', redirect);
        navigate(redirect, { replace: true });
        return;
      }

      if (!token) {
        console.log('[AutoLogin] No token provided');
        setError('Geen login token gevonden');
        setAttempting(false);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        console.log('[AutoLogin] Attempting auto-login with notification token');
        
        // Call the auto-login endpoint
        const response = await axios.post(`${API}/auth/notification-login`, { token });
        
        if (response.data.token && response.data.user) {
          // Store the new token and user data
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Also set cookies for cross-context compatibility
          const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
          document.cookie = `moto_token=${encodeURIComponent(response.data.token)}; expires=${expires}; path=/; SameSite=Lax`;
          document.cookie = `moto_user=${encodeURIComponent(JSON.stringify(response.data.user))}; expires=${expires}; path=/; SameSite=Lax`;
          
          // Set axios header
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          
          console.log('[AutoLogin] Success! Redirecting to:', redirect);
          
          // Force reload to ensure auth context picks up the new token
          window.location.href = redirect;
        } else {
          throw new Error('Invalid response');
        }
      } catch (err) {
        console.error('[AutoLogin] Failed:', err);
        
        const errorMsg = err.response?.data?.detail || 'Automatisch inloggen mislukt';
        setError(errorMsg);
        setAttempting(false);
        
        // Redirect to login after showing error
        setTimeout(() => {
          // Store the intended redirect for after manual login
          sessionStorage.setItem('redirectAfterLogin', redirect);
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    performAutoLogin();
  }, [searchParams, navigate, user]);

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
            <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
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
