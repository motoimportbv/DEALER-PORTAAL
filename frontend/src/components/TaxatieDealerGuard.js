/**
 * TaxatieDealerGuard — beperkt `taxatie_dealer` users tot hun eigen sectie.
 *
 * Een user met role === 'taxatie_dealer' mag ALLEEN deze paths bezoeken:
 *   - /taxatie-dealer/*  (dashboard, register, login, forgot, reset)
 *   - /taxatie           (publieke landing)
 *   - /                  (redirect)
 *   - statische assets en motor-detail pagina's (public)
 *
 * Alle andere paths (/admin, /dealer, /particulier, /foreign-dealer, ...)
 * worden geforceerd naar /taxatie-dealer/dashboard.
 *
 * Op die manier kunnen ze:
 *   ✓ Een taxatie indienen
 *   ✓ Hun eigen profiel beheren
 *   ✗ NIET in het hoofdplatform (geen motoren, geen orders, geen tools)
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Paden die WEL toegankelijk zijn voor een taxatie_dealer
const TAXATIE_DEALER_ALLOWED = [
  '/taxatie-dealer',          // eigen sectie
  '/taxatie',                  // publieke taxatie landing
  '/login',                    // mocht hij/zij willen uitloggen en opnieuw inloggen via fout pad
  '/logout',
  '/forgot-password',
  '/reset-password',
  '/auto-login',
  '/motoren',                  // publiek motor-overzicht (mag iedereen zien)
  '/motor/',
  '/motorcycle/',
  '/motorcycles/',
  '/klant/motor/',
];

function isAllowedForTaxatieDealer(pathname) {
  if (pathname === '/') return true;
  return TAXATIE_DEALER_ALLOWED.some(allowed =>
    pathname === allowed || pathname.startsWith(allowed + '/') || pathname.startsWith(allowed)
  );
}

export default function TaxatieDealerGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'taxatie_dealer') return;
    if (isAllowedForTaxatieDealer(location.pathname)) return;
    // Dealer-portaal is verwijderd (Feb 2026) — stuur dealers naar homepage
    navigate('/', { replace: true });
  }, [user, location.pathname, navigate]);

  return null;
}
