/**
 * HostnameGuard — beperkt het platform tot MotoDirect wanneer bezocht via moto-direct.nl.
 *
 * Wanneer hostname bevat "moto-direct":
 *   - Root "/" redirect naar "/motodirect"
 *   - Alle non-motodirect routes redirect naar "/motodirect"
 *
 * Andere hostnames: geen restrictie (motoimport dealer platform blijft volledig bereikbaar).
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function isMotoDirectHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.includes('moto-direct') || host.startsWith('motodirect.');
}

export default function HostnameGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMotoDirectHost()) return;

    const path = location.pathname;
    // Allow MotoDirect routes + static assets
    if (path.startsWith('/motodirect')) return;

    // Redirect everything else to MotoDirect landing
    navigate('/motodirect', { replace: true });
  }, [location.pathname, navigate]);

  return null;
}
