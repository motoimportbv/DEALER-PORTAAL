import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Bike, User } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ShortCodeLoginPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [attempting, setAttempting] = useState(true);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const performAutoLogin = async () => {
      // If already logged in, just redirect
      if (user) {
        console.log('[ShortCode] Already logged in, redirecting');
        navigate('/dealer', { replace: true });
        return;
      }

      if (!code) {
        console.log('[ShortCode] No code provided');
        setError('Geen code gevonden');
        setAttempting(false);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        console.log('[ShortCode] Attempting login with code:', code);
        
        // First verify the code is valid
        const verifyResponse = await axios.get(`${API}/auth/shortcode/${code}`);
        setCompanyName(verifyResponse.data.company_name);
        
        // Then perform the login
        const response = await axios.post(`${API}/auth/shortcode-login`, { code });
        
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
          
          console.log('[ShortCode] Success! Redirecting to dealer dashboard');
          
          // Force reload to ensure auth context picks up the new token
          window.location.href = '/dealer';
        } else {
          throw new Error('Invalid response');
        }
      } catch (err) {
        console.error('[ShortCode] Failed:', err);
        
        const errorMsg = err.response?.data?.detail || 'Automatisch inloggen mislukt';
        setError(errorMsg);
        setAttempting(false);
        
        // Redirect to login after showing error
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    };

    performAutoLogin();
  }, [code, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Bike className="w-10 h-10 text-white" />
        </div>
        
        {attempting && !error && (
          <>
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
              Even geduld...
            </h2>
            {companyName && (
              <div className="flex items-center justify-center gap-2 text-zinc-600 mb-2">
                <User className="w-4 h-4" />
                <span>{companyName}</span>
              </div>
            )}
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

export default ShortCodeLoginPage;
