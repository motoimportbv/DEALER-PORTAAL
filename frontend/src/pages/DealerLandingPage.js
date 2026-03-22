import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Users, ShoppingBag, TrendingUp, Shield, ChevronRight, MapPin, Bike, Clock, Euro, CheckCircle, Zap } from 'lucide-react';

const dealerContent = {
  badge: 'Het grootste motorplatform van Nederland',
  hero_title: 'Vergroot uw aanbod met Moto Import',
  hero_sub: 'Krijg toegang tot honderden exclusieve motorfietsen van Europese leveranciers. Direct bestellen, wij regelen het transport.',
  cta: 'Word dealer',
  cta_login: 'Inloggen',
  stats_title: 'Waarom dealers kiezen voor Moto Import',
  stats: [
    { num: '100+', label: 'Aangesloten dealers', icon: Users },
    { num: '500+', label: 'Motoren beschikbaar', icon: Bike },
    { num: '6', label: 'Europese landen', icon: MapPin },
    { num: '24u', label: 'Snelle levering', icon: Clock },
  ],
  how_title: 'Zo werkt het',
  steps: [
    { icon: CheckCircle, title: 'Registreer gratis', desc: 'Maak uw account aan op motoimportbv.nl. Geen opstartkosten, geen verplichtingen.' },
    { icon: ShoppingBag, title: 'Bekijk het aanbod', desc: 'Browse door honderden motoren van topmerken uit heel Europa. Altijd actuele prijzen en foto\'s.' },
    { icon: Euro, title: 'Doe een voorstel', desc: 'Onderhandel direct via het platform. U ontvangt binnen 24 uur een reactie op uw voorstel.' },
    { icon: Zap, title: 'Wij leveren', desc: 'Moto Import regelt het transport. De motor wordt direct bij uw zaak afgeleverd.' },
  ],
  features_title: 'Voordelen voor uw zaak',
  features: [
    { title: 'Groter aanbod', desc: 'Toegang tot exclusieve motoren uit Zwitserland, Duitsland, Itali\u00eb, Frankrijk, Belgi\u00eb en Oostenrijk die u nergens anders vindt.' },
    { title: 'Scherpe prijzen', desc: 'Directe contacten met buitenlandse leveranciers betekent concurrerende inkoopprijzen voor uw zaak.' },
    { title: 'Geen gedoe', desc: 'Wij regelen het complete transport, import en alle papierwerk. U hoeft alleen te bestellen.' },
    { title: 'Digitaal platform', desc: 'Alles overzichtelijk in \u00e9\u00e9n platform: aanbod bekijken, voorstellen doen, bestellingen volgen en kentekens beheren.' },
  ],
  brands_title: 'Topmerken beschikbaar',
  brands: ['BMW', 'Triumph', 'KTM', 'Ducati', 'Honda', 'Kawasaki', 'Yamaha', 'Suzuki', 'Brixton', 'Royal Enfield'],
  trust_title: 'Betrouwbaar & professioneel',
  trust_desc: 'Moto Import B.V. is al jaren de schakel tussen Europese motorleveranciers en Nederlandse dealers. Ons platform wordt dagelijks gebruikt door meer dan 100 motorzaken door heel Nederland.',
  footer_cta: 'Klaar om te groeien?',
  footer_desc: 'Sluit u aan bij het grootste dealer netwerk van Nederland. Registreren is gratis en vrijblijvend.',
};

export default function DealerLandingPage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);
  const navigate = useNavigate();
  const t = dealerContent;

  useEffect(() => {
    setHeroVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden" data-testid="dealer-landing">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">MOTO IMPORT</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              data-testid="nav-login-btn"
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-zinc-400 hover:text-white text-sm"
            >
              Inloggen
            </Button>
            <Button
              data-testid="nav-register-btn"
              onClick={() => navigate('/register')}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
            >
              Registreren
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/5622296/pexels-photo-5622296.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/75 to-zinc-950" />
        <div className={`relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-red-600/15 border border-red-500/30 rounded-full px-4 py-1.5 mb-8">
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs sm:text-sm text-red-300 font-medium">{t.badge}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {t.hero_title}
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.hero_sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              data-testid="hero-register-btn"
              onClick={() => navigate('/register')}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-base sm:text-lg font-bold rounded-xl shadow-2xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-red-600/50"
            >
              {t.cta} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              data-testid="hero-login-btn"
              variant="outline"
              onClick={() => navigate('/login')}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white px-8 py-6 text-base sm:text-lg font-medium rounded-xl transition-all duration-300"
            >
              {t.cta_login}
            </Button>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-6 h-6 text-zinc-500 rotate-90" />
        </div>
      </section>

      {/* Stats */}
      <section ref={statsRef} className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-4">{t.stats_title}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-12">
            {t.stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className={`bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 sm:p-8 text-center transition-all duration-700 hover:border-red-500/40 hover:bg-zinc-900 ${
                    statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  <Icon className="w-6 h-6 text-red-500 mx-auto mb-3" />
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {stat.num}
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-16">{t.how_title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {t.steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative group">
                  {i < 3 && (
                    <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-px bg-gradient-to-r from-red-500/40 to-transparent" />
                  )}
                  <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-6 sm:p-8 transition-all duration-500 hover:border-red-500/30 hover:bg-zinc-900/90 hover:-translate-y-1">
                    <div className="relative w-14 h-14 bg-red-600/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-600/20 transition-colors">
                      <span className="text-xs font-bold absolute -top-2 -left-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
                      <Icon className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-16">{t.features_title}</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {t.features.map((feat, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-8 transition-all duration-500 hover:border-red-500/30 hover:bg-zinc-900/90">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-red-600/15 border border-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest mb-12">{t.brands_title}</h2>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {t.brands.map((brand, i) => (
              <span key={i} className="px-5 py-3 bg-zinc-800/60 border border-zinc-700/40 rounded-xl text-sm sm:text-base text-white font-bold tracking-wide hover:border-red-500/40 hover:bg-zinc-800 transition-all duration-300 cursor-default">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-widest">{t.trust_title}</span>
          </div>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-3xl mx-auto">
            {t.trust_desc}
          </p>
        </div>
      </section>

      {/* Website Preview */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-4">MOTOIMPORTBV.NL</h2>
          <p className="text-center text-zinc-500 mb-12 text-sm">Ons professionele dealer platform</p>
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black/50">
            <div className="bg-zinc-900 px-4 py-3 flex items-center gap-2 border-b border-zinc-800/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 bg-zinc-800 rounded-lg px-3 py-1 text-xs text-zinc-500 text-center font-mono">
                motoimportbv.nl
              </div>
            </div>
            <img
              src="https://customer-assets.emergentagent.com/job_dealer-moto-portal/artifacts/338sojwi_Screenshot_20260124_144156_ChatGPT.jpg"
              alt="Moto Import Platform"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {t.footer_cta}
          </h2>
          <p className="text-base sm:text-lg text-zinc-400 mb-10 max-w-xl mx-auto">{t.footer_desc}</p>
          <Button
            data-testid="footer-register-btn"
            onClick={() => navigate('/register')}
            className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-red-600/50"
          >
            {t.cta} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-600">
            <span>Moto Import B.V.</span>
            <span className="hidden sm:inline">{'\u2022'}</span>
            <span>+31 6 24264861</span>
            <span className="hidden sm:inline">{'\u2022'}</span>
            <a href="mailto:motoimportbv@gmail.com" className="text-zinc-500 hover:text-red-400 transition-colors">motoimportbv@gmail.com</a>
          </div>
        </div>
      </section>
    </div>
  );
}
