/**
 * HostnameGuard — beperkt het platform tot MotoDirect wanneer bezocht via moto-direct.nl.
 *
 * Werkt via 2 mechanismes:
 * 1. `REACT_APP_MOTODIRECT_ONLY=true` env var → altijd alleen MotoDirect (voor aparte deployment)
 * 2. Hostname bevat "moto-direct" → alleen MotoDirect (voor multi-domain deployment)
 *
 * Andere gevallen: geen restrictie (motoimport dealer platform blijft volledig bereikbaar).
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function isMotoDirectOnlyMode() {
  // Force MotoDirect-only via env variable (voor aparte deployment)
  if (process.env.REACT_APP_MOTODIRECT_ONLY === 'true') return true;
  // Detect via hostname
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.includes('moto-direct') || host.startsWith('motodirect.');
}

export default function HostnameGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMotoDirectOnlyMode()) return;

    const path = location.pathname;
    // Allow MotoDirect routes + static assets
    if (path.startsWith('/motodirect')) return;

    // Redirect everything else to MotoDirect landing
    navigate('/motodirect', { replace: true });
  }, [location.pathname, navigate]);

  return null;
}
