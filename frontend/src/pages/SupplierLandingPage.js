import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Play, Pause, ArrowRight, Users, Truck, Globe, Shield, ChevronRight, MapPin, BarChart3, Clock, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const languages = [
  { code: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'fr', label: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}' },
];

const content = {
  it: {
    hero_title: 'Vendi le tue moto ai concessionari olandesi',
    hero_sub: 'Moto Import BV collega fornitori internazionali con oltre 100 concessionari nei Paesi Bassi',
    cta: 'Registrati ora',
    cta_login: 'Accedi',
    video_title: 'Guarda il nostro video promozionale',
    how_title: 'Come funziona',
    steps: [
      { title: 'Registrati', desc: 'Crea il tuo account gratuito su motoimportbv.nl in pochi minuti' },
      { title: 'Carica le tue moto', desc: 'Aggiungi foto, prezzi e specifiche delle tue motociclette' },
      { title: 'Ricevi ordini', desc: 'I concessionari olandesi vedono la tua offerta e ordinano direttamente' },
      { title: 'Consegna e incassa', desc: 'Noi gestiamo la logistica, tu ricevi il pagamento' },
    ],
    stats_title: 'Perch\u00e9 scegliere Moto Import?',
    stats: [
      { num: '100+', label: 'Concessionari in Olanda' },
      { num: '24h', label: 'Visibilit\u00e0 immediata' },
      { num: '6', label: 'Paesi collegati' },
      { num: '0\u20ac', label: 'Costi di registrazione' },
    ],
    trust_title: 'La piattaforma leader nei Paesi Bassi',
    trust_desc: 'Moto Import BV \u00e8 il ponte tra fornitori europei e il mercato motociclistico olandese. Con la nostra rete di oltre 100 concessionari, le vostre moto raggiungono immediatamente gli acquirenti giusti.',
    countries: 'Svizzera \u2022 Germania \u2022 Italia \u2022 Francia \u2022 Belgio \u2022 Austria',
    footer_cta: 'Inizia oggi stesso',
    footer_desc: 'Unisciti a centinaia di fornitori che vendono con successo ai concessionari olandesi',
    video_file: 'moto_import_reclame_it.mp4',
  },
  de: {
    hero_title: 'Verkaufen Sie Ihre Motorr\u00e4der an niederl\u00e4ndische H\u00e4ndler',
    hero_sub: 'Moto Import BV verbindet internationale Lieferanten mit \u00fcber 100 H\u00e4ndlern in den Niederlanden',
    cta: 'Jetzt registrieren',
    cta_login: 'Anmelden',
    video_title: 'Sehen Sie unser Werbevideo',
    how_title: 'So funktioniert es',
    steps: [
      { title: 'Registrieren', desc: 'Erstellen Sie Ihr kostenloses Konto auf motoimportbv.nl in wenigen Minuten' },
      { title: 'Motorr\u00e4der hochladen', desc: 'F\u00fcgen Sie Fotos, Preise und Spezifikationen Ihrer Motorr\u00e4der hinzu' },
      { title: 'Bestellungen erhalten', desc: 'Niederl\u00e4ndische H\u00e4ndler sehen Ihr Angebot und bestellen direkt' },
      { title: 'Liefern & kassieren', desc: 'Wir k\u00fcmmern uns um die Logistik, Sie erhalten die Zahlung' },
    ],
    stats_title: 'Warum Moto Import w\u00e4hlen?',
    stats: [
      { num: '100+', label: 'H\u00e4ndler in den Niederlanden' },
      { num: '24h', label: 'Sofortige Sichtbarkeit' },
      { num: '6', label: 'Verbundene L\u00e4nder' },
      { num: '0\u20ac', label: 'Registrierungskosten' },
    ],
    trust_title: 'Die f\u00fchrende Plattform in den Niederlanden',
    trust_desc: 'Moto Import BV ist die Br\u00fccke zwischen europ\u00e4ischen Lieferanten und dem niederl\u00e4ndischen Motorradmarkt. Mit unserem Netzwerk von \u00fcber 100 H\u00e4ndlern erreichen Ihre Motorr\u00e4der sofort die richtigen K\u00e4ufer.',
    countries: 'Schweiz \u2022 Deutschland \u2022 Italien \u2022 Frankreich \u2022 Belgien \u2022 \u00d6sterreich',
    footer_cta: 'Starten Sie noch heute',
    footer_desc: 'Schlie\u00dfen Sie sich Hunderten von Lieferanten an, die erfolgreich an niederl\u00e4ndische H\u00e4ndler verkaufen',
    video_file: 'moto_import_reclame_de.mp4',
  },
  fr: {
    hero_title: 'Vendez vos motos aux concessionnaires n\u00e9erlandais',
    hero_sub: 'Moto Import BV connecte les fournisseurs internationaux avec plus de 100 concessionnaires aux Pays-Bas',
    cta: "S'inscrire maintenant",
    cta_login: 'Se connecter',
    video_title: 'Regardez notre vid\u00e9o promotionnelle',
    how_title: 'Comment \u00e7a marche',
    steps: [
      { title: 'Inscrivez-vous', desc: 'Cr\u00e9ez votre compte gratuit sur motoimportbv.nl en quelques minutes' },
      { title: 'T\u00e9l\u00e9chargez vos motos', desc: 'Ajoutez photos, prix et sp\u00e9cifications de vos motos' },
      { title: 'Recevez des commandes', desc: 'Les concessionnaires n\u00e9erlandais voient votre offre et commandent directement' },
      { title: 'Livrez et encaissez', desc: 'Nous g\u00e9rons la logistique, vous recevez le paiement' },
    ],
    stats_title: 'Pourquoi choisir Moto Import?',
    stats: [
      { num: '100+', label: 'Concessionnaires aux Pays-Bas' },
      { num: '24h', label: 'Visibilit\u00e9 imm\u00e9diate' },
      { num: '6', label: 'Pays connect\u00e9s' },
      { num: '0\u20ac', label: "Frais d'inscription" },
    ],
    trust_title: 'La plateforme leader aux Pays-Bas',
    trust_desc: "Moto Import BV est le pont entre les fournisseurs europ\u00e9ens et le march\u00e9 moto n\u00e9erlandais. Avec notre r\u00e9seau de plus de 100 concessionnaires, vos motos atteignent imm\u00e9diatement les bons acheteurs.",
    countries: 'Suisse \u2022 Allemagne \u2022 Italie \u2022 France \u2022 Belgique \u2022 Autriche',
    footer_cta: "Commencez aujourd'hui",
    footer_desc: 'Rejoignez des centaines de fournisseurs qui vendent avec succ\u00e8s aux concessionnaires n\u00e9erlandais',
    video_file: null,
  },
};

const stepIcons = [Globe, BarChart3, Truck, Star];

export default function SupplierLandingPage() {
  const [lang, setLang] = useState('de');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const videoRef = useRef(null);
  const statsRef = useRef(null);
  const navigate = useNavigate();
  const t = content[lang];

  useEffect(() => {
    setHeroVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleVideo = () => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
      setVideoPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setVideoPlaying(true);
      }).catch(() => {
        videoRef.current.muted = true;
        videoRef.current.play().then(() => setVideoPlaying(true));
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden" data-testid="supplier-landing">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">MOTO IMPORT</span>
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-1 sm:gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                data-testid={`lang-switch-${l.code}`}
                onClick={() => setLang(l.code)}
                className={`px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                  lang === l.code
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <span className="mr-1">{l.flag}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/job_dealer-moto-portal/artifacts/338sojwi_Screenshot_20260124_144156_ChatGPT.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/70 to-zinc-950" />
        <div className={`relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 bg-red-600/15 border border-red-500/30 rounded-full px-4 py-1.5 mb-8">
            <MapPin className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs sm:text-sm text-red-300 font-medium">{t.countries}</span>
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
              onClick={() => navigate(`/register/supplier?lang=${lang}`)}
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
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-6 h-6 text-zinc-500 rotate-90" />
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-4">{t.stats_title}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-12">
            {t.stats.map((stat, i) => (
              <div
                key={i}
                className={`bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 sm:p-8 text-center transition-all duration-700 hover:border-red-500/40 hover:bg-zinc-900 ${
                  statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {stat.num}
                </div>
                <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      {t.video_file && (
        <section className="py-20 sm:py-28 bg-zinc-900/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-12">{t.video_title}</h2>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-zinc-800/50 aspect-video bg-black group cursor-pointer" onClick={toggleVideo}>
              <video
                ref={videoRef}
                src={`${API}/api/uploads/${t.video_file}`}
                className="w-full h-full object-cover"
                onEnded={() => setVideoPlaying(false)}
                onPause={() => setVideoPlaying(false)}
                onPlay={() => setVideoPlaying(true)}
                playsInline
                preload="auto"
                controls
                data-testid="promo-video"
              />
              {/* Play/Pause overlay */}
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${videoPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} bg-black/30`}>
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40 transition-transform duration-300 hover:scale-110">
                  {videoPlaying
                    ? <Pause className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    : <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1" />
                  }
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* How it Works */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-16">{t.how_title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {t.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <div key={i} className="relative group">
                  {/* Connector line (hidden on mobile, visible on lg) */}
                  {i < 3 && (
                    <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-px bg-gradient-to-r from-red-500/40 to-transparent" />
                  )}
                  <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-6 sm:p-8 transition-all duration-500 hover:border-red-500/30 hover:bg-zinc-900/90 hover:-translate-y-1">
                    <div className="w-14 h-14 bg-red-600/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-600/20 transition-colors">
                      <span className="text-xs font-bold text-red-400 absolute -top-0 -left-0 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
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

      {/* Trust / About Section */}
      <section className="py-20 sm:py-28 bg-zinc-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-widest">{t.trust_title}</span>
          </div>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-3xl mx-auto mb-8">
            {t.trust_desc}
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {t.countries.split(' \u2022 ').map((country, i) => (
              <span key={i} className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/40 rounded-full text-sm text-zinc-300 font-medium">
                {country}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot Section - Website Preview */}
      <section className="py-20 sm:py-28 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-red-500 uppercase tracking-widest text-center mb-4">MOTOIMPORTBV.NL</h2>
          <p className="text-center text-zinc-500 mb-12 text-sm">
            {lang === 'it' ? 'La nostra piattaforma professionale per fornitori' :
             lang === 'de' ? 'Unsere professionelle Plattform f\u00fcr Lieferanten' :
             'Notre plateforme professionnelle pour les fournisseurs'}
          </p>
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
            onClick={() => navigate(`/register/supplier?lang=${lang}`)}
            className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-red-600/50"
          >
            {t.cta} <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-600">
            <span>Moto Import B.V.</span>
            <span className="hidden sm:inline">\u2022</span>
            <span>+31 6 24264861</span>
            <span className="hidden sm:inline">\u2022</span>
            <a href="mailto:motoimportbv@gmail.com" className="text-zinc-500 hover:text-red-400 transition-colors">motoimportbv@gmail.com</a>
          </div>
        </div>
      </section>
    </div>
  );
}
