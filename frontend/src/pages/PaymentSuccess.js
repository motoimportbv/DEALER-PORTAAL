import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader2, XCircle, Home, FileText } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [paymentData, setPaymentData] = useState(null);

  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (sessionId) {
      checkPaymentStatus();
    }
  }, [sessionId]);

  const checkPaymentStatus = async () => {
    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`);
      setPaymentData(response.data);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
      } else if (response.data.payment_status === 'unpaid') {
        setStatus('pending');
      } else {
        setStatus('failed');
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      setStatus('error');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price / 100); // Stripe returns amount in cents
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-red-600 animate-spin" />
              <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
                Betaling Verifiëren...
              </h1>
              <p className="text-zinc-500">Even geduld alstublieft</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
                Betaling Geslaagd!
              </h1>
              <p className="text-zinc-500 mb-6">
                Uw aanbetaling is succesvol ontvangen. Wij nemen zo snel mogelijk contact met u op.
              </p>
              {paymentData && (
                <div className="p-4 bg-zinc-100 rounded-lg mb-6 text-left">
                  <p className="text-sm text-zinc-600">
                    <strong>Betaald:</strong> {formatPrice(paymentData.amount_total)}
                  </p>
                  <p className="text-sm text-zinc-600">
                    <strong>Order ID:</strong> {orderId}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                <Link to="/dealer" className="block">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    <Home className="w-4 h-4 mr-2" />
                    Terug naar Dashboard
                  </Button>
                </Link>
                <Link to="/dealer/orders" className="block">
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Bekijk Mijn Bestellingen
                  </Button>
                </Link>
              </div>
            </>
          )}

          {status === 'pending' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-amber-500 animate-spin" />
              <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
                Betaling in Behandeling
              </h1>
              <p className="text-zinc-500 mb-6">
                Uw betaling wordt nog verwerkt. Dit kan enkele minuten duren.
              </p>
              <Button onClick={checkPaymentStatus} variant="outline">
                Opnieuw Controleren
              </Button>
            </>
          )}

          {(status === 'failed' || status === 'error') && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
                Betaling Mislukt
              </h1>
              <p className="text-zinc-500 mb-6">
                Er is iets misgegaan met uw betaling. Probeer het opnieuw of neem contact met ons op.
              </p>
              <div className="space-y-3">
                <Link to="/dealer" className="block">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Terug naar Dashboard
                  </Button>
                </Link>
              </div>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-zinc-200 text-sm text-zinc-500">
            <p className="font-semibold">Moto Import B.V.</p>
            <p>Horsterhoekweg 11, 7433 SV Schalkhaar</p>
            <p>+31 6 81792660 • Motoimportbv@gmail.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
