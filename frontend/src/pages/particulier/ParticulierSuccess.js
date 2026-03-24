import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParticulierSuccess() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId || !token) {
      setStatus('error');
      return;
    }
    checkPayment();
  }, []);

  const checkPayment = async () => {
    try {
      const res = await fetch(`${API}/api/private-listings/checkout-status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.payment_status === 'paid') {
        setStatus('success');
      } else {
        setStatus('pending');
        // Retry after 3 seconds
        setTimeout(checkPayment, 3000);
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 text-red-400 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Betaling verwerken...</h1>
            <p className="text-zinc-400 text-sm">Even geduld alstublieft</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <Loader2 className="w-16 h-16 text-yellow-400 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Betaling wordt verwerkt</h1>
            <p className="text-zinc-400 text-sm">Dit kan enkele seconden duren...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Betaling gelukt!</h1>
            <p className="text-zinc-400 text-sm mb-6">
              Uw motor is nu 1 week lang zichtbaar voor 100+ dealers in Nederland. 
              U ontvangt bericht als een dealer interesse heeft.
            </p>
            <Button
              onClick={() => navigate('/particulier')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl"
            >
              Naar mijn advertenties
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Er ging iets mis</h1>
            <p className="text-zinc-400 text-sm mb-6">Probeer het opnieuw of neem contact op met Moto Import.</p>
            <Button
              onClick={() => navigate('/particulier')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl"
            >
              Terug naar dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
