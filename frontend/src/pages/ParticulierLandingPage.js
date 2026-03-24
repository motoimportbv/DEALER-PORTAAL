import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/button';
import ReviewSection from '../components/ReviewSection';
import {
  ArrowRight,
  Users,
  Euro,
  Shield,
  ChevronRight,
  CheckCircle,
  Bike,
  Clock,
  Camera,
  CreditCard,
  Eye,
  Phone,
  HelpCircle,
  ChevronDown,
  Zap,
} from 'lucide-react';

const content = {
  badge: 'Voor particulieren in heel Nederland',
  hero_title: 'Verkoop uw motor aan 100+ dealers',
  hero_sub: 'Bied uw motor aan via het grootste dealer netwerk van Nederland. Geen gedoe met Marktplaats, direct bereik bij serieuze kopers.',
  cta: 'Motor aanbieden',
  cta_login: 'Inloggen',
  price_badge: '7,95',
  price_period: 'per week',
  stats: [
    { num: '100+', label: 'Aangesloten dealers', icon: Users },
    { num: '7 dagen', label: 'Advertentie actief', icon: Clock },
    { num: 'iDEAL', label: 'Veilig betalen', icon: CreditCard },
    { num: '24u', label: 'Direct zichtbaar', icon: Zap },
  ],
  how_title: 'Zo verkoopt u uw motor',
  steps: [
    { icon: Camera, title: 'Maak een account', desc: 'Registreer gratis op ons platform. Binnen 1 minuut klaar.' },
    { icon: Bike, title: 'Voer uw motor in', desc: 'Vul merk, model, bouwjaar, km-stand en uw vraagprijs in.' },
    { icon: CreditCard, title: 'Betaal eenmalig', desc: 'Betaal slechts \u20ac7,95 via iDEAL of creditcard voor 7 dagen zichtbaarheid.' },
    { icon: Eye, title: 'Dealers zien uw motor', desc: 'Alle 100+ aangesloten dealers kunnen uw motor direct bekijken en contact opnemen.' },
  ],
  features_title: 'Waarom via Moto Import?',
  features: [
    { title: 'Direct bereik bij 100+ dealers', desc: 'Geen wachttijden op Marktplaats of Facebook. Uw motor wordt direct gezien door professionele motorzaken in heel Nederland.' },
    { title: 'Eerlijke prijs', desc: 'Dealers kennen de markt en bieden een realistisch bod. Geen onderhandelen met tientallen particulieren.' },
    { title: 'Veilig & betrouwbaar', desc: 'Alle dealers zijn geverifieerd door Moto Import B.V. U verkoopt aan een professionele partij, niet aan een onbekende.' },
    { title: 'Snel verkocht', desc: 'De meeste motoren worden binnen de eerste week verkocht. Een dealer regelt de rest: transport, overschrijving, alles.' },
  ],
  faq_title: 'Veelgestelde vragen',
  faqs: [
    { q: 'Wat kost het om mijn motor aan te bieden?', a: 'Het aanbieden kost \u20ac7,95 per week. U betaalt eenmalig via iDEAL of creditcard. Uw motor is dan 7 dagen zichtbaar voor alle dealers.' },
    { q: 'Hoe weet ik of een dealer interesse heeft?', a: 'Dealers zien uw contactgegevens en nemen rechtstreeks contact met u op via telefoon of e-mail als zij interesse hebben.' },
    { q: 'Welke merken/modellen kan ik aanbieden?', a: 'Alle merken en modellen zijn welkom. Van BMW en Ducati tot Kawasaki, Yamaha, Honda, Triumph, KTM en meer.' },
    { q: 'Kan ik mijn advertentie verlengen?', a: 'Ja, na 7 dagen kunt u eenvoudig opnieuw betalen om uw advertentie te verlengen.' },
    { q: 'Is er een commissie bij verkoop?', a: 'Nee, er is geen extra commissie. U betaalt alleen de vaste advertentiekosten van \u20ac7,95. De verkoopprijs spreekt u rechtstreeks af met de dealer.' },
  ],
  trust_title: 'Vertrouwd door heel Nederland',
  trust_desc: 'Moto Import B.V. is al jaren het grootste platform dat motorhandelaren verbindt. Ons netwerk van meer dan 100 dealers door heel Nederland garandeert dat uw motor bij de juiste koper terecht komt.',
  footer_cta: 'Klaar om te verkopen?',
  footer_desc: 'Bied uw motor vandaag nog aan bij 100+ professionele dealers in Nederland. Snel, veilig en eerlijk.',
};

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-800/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid="faq-toggle"
      >
        <span className="text-base font-semibold text-white group-hover:text-red-400 transition-colors pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-zinc-500 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-red-400' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="text-sm text-zinc-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function ParticulierLandingPage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);
  const navigate = useNavigate();
  const t = content;

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
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden" data-testid="particulier-landing">
      <Helmet>
        <title>Motor Verkopen? Bied aan bij 100+ Dealers | Moto Import BV</title>
        <meta name="description" content="Verkoop uw motor snel en eerlijk via Moto Import BV. Uw motor wordt direct gezien door 100+ professionele dealers in Nederland. Vanaf slechts \u20ac7,95 per week. Veilig betalen via iDEAL." />
        <meta property="og:title" content="Motor Verkopen? Bied aan bij 100+ Dealers | Moto Import BV" />
        <meta property="og:description" content="Verkoop uw motor snel en eerlijk aan professionele dealers. Geen gedoe met Marktplaats, direct bereik bij 100+ motorzaken." />
        <meta property="og:url" content="https://motoimportbv.nl/particulier-verkopen" />
        <link rel="canonical" href="https://motoimportbv.nl/particulier-verkopen" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Moto Import - Motor Verkopen als Particulier",
          "description": "Bied uw motor aan bij 100+ professionele dealers in Nederland",
          "provider": { "@type": "Organization", "name": "Moto Import B.V." },
          "areaServed": "NL",
          "offers": { "@type": "Offer", "price": "7.95", "priceCurrency": "EUR", "description": "7 dagen zichtbaarheid voor alle dealers" }
        })}</script>
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
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
              onClick={() => navigate('/register/particulier')}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
            >
              Registreren
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative min-h-screen flex items-center justify-center pt-16"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1770794550452-51f02fb536a7?auto=format&w=1600&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/80 to-zinc-950" />
        <div className={`relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-red-600/15 border border-red-500/30 rounded-full px-4 py-1.5 mb-8">
            <Users className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs sm:text-sm text-red-300 font-medium">{t.badge}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {t.hero_title}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t.hero_sub}
          </p>

          {/* Price badge */}
          <div className="inline-flex items-baseline gap-1 bg-zinc-900/80 border border-zinc-700/50 rounded-2xl px-6 py-3 mb-10 backdrop-blur-sm">
            <span className="text-zinc-500 text-sm">Vanaf</span>
            <span className="text-4xl font-black text-white ml-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>&euro;{t.price_badge}</span>
            <span className="text-zinc-500 text-sm ml-1">{t.price_period}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              data-testid="hero-register-btn"
              onClick={() => navigate('/register/particulier')}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                  <div className="text-3xl sm:text-4xl font-black text-white mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
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

      {/* Pricing */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest mb-12">Eenvoudige prijs</h2>
          <div className="bg-zinc-900/80 border-2 border-red-500/30 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">POPULAIR</div>
            <div className="flex items-baseline justify-center gap-1 mb-4">
              <span className="text-6xl sm:text-7xl font-black text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>&euro;7,95</span>
              <span className="text-zinc-500 text-lg">/week</span>
            </div>
            <p className="text-zinc-400 text-sm mb-8">Eenmalige betaling via iDEAL of creditcard</p>
            <div className="space-y-3 text-left max-w-sm mx-auto mb-10">
              {[
                '7 dagen lang zichtbaar voor 100+ dealers',
                'Direct bereik bij professionele kopers',
                'Contactgegevens zichtbaar voor dealers',
                'Geen extra commissie bij verkoop',
                'Alle merken en modellen welkom',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">{item}</span>
                </div>
              ))}
            </div>
            <Button
              data-testid="pricing-cta-btn"
              onClick={() => navigate('/register/particulier')}
              className="bg-red-600 hover:bg-red-700 text-white px-10 py-5 text-lg font-bold rounded-xl shadow-2xl shadow-red-600/30 transition-all duration-300 hover:scale-105"
            >
              Nu motor aanbieden <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
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

      {/* FAQ */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 mb-12">
            <HelpCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest">{t.faq_title}</h2>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl px-6 sm:px-8">
            {t.faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <ReviewSection lang="nl" />

      {/* Final CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {t.footer_cta}
          </h2>
          <p className="text-base sm:text-lg text-zinc-400 mb-10 max-w-xl mx-auto">{t.footer_desc}</p>
          <Button
            data-testid="footer-register-btn"
            onClick={() => navigate('/register/particulier')}
            className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-red-600/50"
          >
            Motor aanbieden <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <div className="mt-6 text-sm text-zinc-600">
            Al een account? <button onClick={() => navigate('/login')} className="text-red-400 hover:text-red-300 transition-colors">Inloggen</button>
          </div>
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
