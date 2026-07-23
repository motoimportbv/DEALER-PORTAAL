import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectCheckoutSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');
  const [state, setState] = useState({ loading: true, paid: false, error: null, order: null });
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      navigate('/motodirect');
      return;
    }
    const token = localStorage.getItem('motodirect_token');
    if (!token) {
      navigate('/motodirect/login');
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      if (attempts.current >= 15) {
        setState({ loading: false, paid: false, error: 'Betaling niet afgerond binnen verwachte tijd. Neem contact op.', order: null });
        return;
      }
      attempts.current += 1;
      try {
        const res = await axios.get(`${API}/motodirect/order-status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.payment_status === 'paid') {
          setState({ loading: false, paid: true, error: null, order: res.data });
          return;
        }
        if (res.data.status === 'expired') {
          setState({ loading: false, paid: false, error: 'Betaalsessie is verlopen.', order: null });
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setState({ loading: false, paid: false, error: e?.response?.data?.detail || 'Kon status niet ophalen', order: null });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, navigate]);

  return (
    <MotoDirectLayout>
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        {state.loading ? (
          <div data-testid="checkout-loading">
            <Loader2 className="w-12 h-12 text-[#0047FF] animate-spin mx-auto mb-6" />
            <h1 className="heading text-3xl font-bold text-white mb-2">Betaling verwerken...</h1>
            <p className="text-neutral-400">Even geduld, we controleren jouw betaling bij Stripe.</p>
          </div>
        ) : state.paid ? (
          <div data-testid="checkout-success">
            <div className="w-16 h-16 bg-[#00FF66]/10 border border-[#00FF66]/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#00FF66]" strokeWidth={1.5} />
            </div>
            <h1 className="heading text-4xl md:text-5xl font-bold text-white mb-4">Aanbetaling ontvangen!</h1>
            <p className="text-neutral-400 text-lg mb-2">Jouw <b className="text-white">{state.order?.motorcycle?.brand} {state.order?.motorcycle?.model}</b> is gereserveerd.</p>
            <p className="text-neutral-400 mb-10">We nemen zo snel mogelijk contact op om de import en levering te regelen.</p>
            <div className="grid grid-cols-3 gap-4 mb-10 max-w-md mx-auto">
              <StatBox label="Aanbetaling" value={`€${Math.round(state.order?.deposit_amount || 0)}`} />
              <StatBox label="Restant" value={`€${Math.round(state.order?.remaining_amount || 0)}`} />
              <StatBox label="Totaal" value={`€${Math.round(state.order?.total_price || 0)}`} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/motodirect/account" data-testid="go-to-account" className="bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold px-6 py-3">Bekijk mijn bestelling</Link>
              <Link to="/motodirect/catalog" className="border border-neutral-700 hover:border-white text-white font-semibold px-6 py-3">Terug naar catalogus</Link>
            </div>
          </div>
        ) : (
          <div data-testid="checkout-error">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            </div>
            <h1 className="heading text-3xl font-bold text-white mb-4">Iets ging mis</h1>
            <p className="text-neutral-400 mb-8">{state.error}</p>
            <Link to="/motodirect/catalog" className="inline-block bg-[#0047FF] text-white font-semibold px-6 py-3">Terug naar catalogus</Link>
          </div>
        )}
      </div>
    </MotoDirectLayout>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="border border-[#1c1c1c] p-4">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="heading text-xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}
