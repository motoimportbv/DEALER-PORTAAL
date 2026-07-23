import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut } from 'lucide-react';

const NAV_LINKS = [
  { to: '/motodirect', label: 'Home' },
  { to: '/motodirect/catalog', label: 'Motoren' },
  { to: '/motodirect/hoe-werkt-het', label: 'Hoe werkt het' },
];

export default function MotoDirectLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [buyer, setBuyer] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('motodirect_user');
    if (raw) {
      try { setBuyer(JSON.parse(raw)); } catch { setBuyer(null); }
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('motodirect_token');
    localStorage.removeItem('motodirect_user');
    setBuyer(null);
    navigate('/motodirect');
  };

  return (
    <div className="motodirect-shell min-h-screen bg-[#050505] text-white antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        .motodirect-shell { font-family: 'IBM Plex Sans', sans-serif; letter-spacing: -0.01em; }
        .motodirect-shell h1, .motodirect-shell h2, .motodirect-shell h3, .motodirect-shell .heading {
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: -0.03em;
        }
        .motodirect-shell ::selection { background: #0047FF; color: #fff; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#050505]/85 border-b border-[#1c1c1c]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link
            to="/motodirect"
            data-testid="motodirect-logo"
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 bg-[#0047FF] flex items-center justify-center">
              <span className="heading text-white text-lg font-bold">M</span>
            </div>
            <div className="leading-none">
              <span className="heading text-white text-lg font-bold tracking-tight">MOTO<span className="text-[#0047FF]">DIRECT</span></span>
              <div className="text-[10px] text-neutral-500 tracking-widest uppercase mt-0.5">Direct van de importeur</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`text-sm font-medium transition-colors ${active ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            {buyer ? (
              <>
                <Link
                  to="/motodirect/account"
                  data-testid="account-link"
                  className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors px-3 py-2"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{buyer.name || 'Account'}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  data-testid="logout-btn"
                  className="text-neutral-400 hover:text-white p-2"
                  aria-label="Uitloggen"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/motodirect/login"
                  data-testid="header-login-btn"
                  className="text-sm font-medium text-neutral-300 hover:text-white transition-colors px-3 py-2"
                >
                  Inloggen
                </Link>
                <Link
                  to="/motodirect/register"
                  data-testid="header-register-btn"
                  className="text-sm font-semibold bg-[#0047FF] hover:bg-[#0033CC] text-white px-5 py-2.5 transition-all hover:-translate-y-0.5"
                >
                  Registreer
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="mobile-menu-toggle"
            className="md:hidden text-white"
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0a0a0a] border-t border-[#1c1c1c]">
            <div className="px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="py-3 text-neutral-300 hover:text-white text-base"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-[#1c1c1c] mt-2 pt-4 flex flex-col gap-2">
                {buyer ? (
                  <>
                    <Link
                      to="/motodirect/account"
                      onClick={() => setMenuOpen(false)}
                      className="py-3 text-neutral-300"
                    >
                      Account
                    </Link>
                    <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="py-3 text-left text-neutral-400">Uitloggen</button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/motodirect/login"
                      onClick={() => setMenuOpen(false)}
                      className="py-3 text-neutral-300"
                    >
                      Inloggen
                    </Link>
                    <Link
                      to="/motodirect/register"
                      onClick={() => setMenuOpen(false)}
                      className="py-3 bg-[#0047FF] text-white text-center font-semibold"
                    >
                      Registreer
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#1c1c1c] bg-[#050505] mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="heading text-2xl font-bold tracking-tight">MOTO<span className="text-[#0047FF]">DIRECT</span></div>
            <p className="text-sm text-neutral-400 mt-4 max-w-md leading-relaxed">
              Direct van de importeur. Geen dealermarge. Particulieren krijgen dezelfde prijzen als officiële dealers, met 35% aanbetaling en veilige betaling via Stripe.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/motodirect/catalog" className="text-neutral-300 hover:text-white">Motoren</Link></li>
              <li><Link to="/motodirect/hoe-werkt-het" className="text-neutral-300 hover:text-white">Hoe werkt het</Link></li>
              <li><Link to="/motodirect/register" className="text-neutral-300 hover:text-white">Registreer</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>
                <a href="mailto:info@moto-direct.nl" className="hover:text-white transition-colors" data-testid="footer-email">info@moto-direct.nl</a>
              </li>
              <li>
                <a href="tel:+31638525541" className="hover:text-white transition-colors" data-testid="footer-phone">+31 6 38 52 55 41</a>
              </li>
              <li className="flex items-center gap-1.5 text-[#00FF66] text-xs mt-1">
                <span className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
                24/7 online bereikbaar
              </li>
              <li className="text-xs mt-3 pt-3 border-t border-[#1c1c1c] text-neutral-500">
                Onderdeel van MotoImport BV<br />
                KVK 94622086
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#1c1c1c]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 text-xs text-neutral-500 flex flex-col md:flex-row justify-between gap-2">
            <div>© {new Date().getFullYear()} MotoDirect.nl — Alle rechten voorbehouden</div>
            <div className="flex gap-6">
              <span>GDPR-veilig</span>
              <span>Beveiligd via Stripe</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
