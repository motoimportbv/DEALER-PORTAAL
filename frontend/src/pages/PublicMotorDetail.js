import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/button';
import { Bike, ChevronLeft, Calendar, Gauge, MapPin, Palette, Phone, Mail, User, Building2, Eye, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

export default function PublicMotorDetail() {
  const { id } = useParams();
  const [motor, setMotor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestForm, setInterestForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const fetchMotor = async () => {
      try {
        const res = await fetch(`${API}/api/public/motors/${id}`);
        if (res.ok) setMotor(await res.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchMotor();
  }, [id]);

  const handleInterestSubmit = async (e) => {
    e.preventDefault();
    if (!interestForm.email && !interestForm.phone) {
      toast.error('Vul uw email of telefoonnummer in');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/api/public/motors/${id}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interestForm),
      });
      if (res.ok) {
        setSent(true);
        toast.success('Uw interesse is verstuurd!');
      }
    } catch {
      toast.error('Er ging iets mis');
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!motor) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
          <h1 className="text-2xl font-bold text-zinc-700 mb-2">Motor niet gevonden</h1>
          <Link to="/motoren"><Button className="bg-red-600 hover:bg-red-700 text-white mt-4">Terug naar overzicht</Button></Link>
        </div>
      </div>
    );
  }

  const title = `${motor.brand} ${motor.model} ${motor.year} Te Koop`;
  const images = motor.images || [];

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="public-motor-detail">
      <Helmet>
        <title>{title} | Moto Import BV</title>
        <meta name="description" content={`${motor.brand} ${motor.model} (${motor.year}) te koop voor ${formatPrice(motor.price)}. ${motor.mileage ? motor.mileage.toLocaleString('nl-NL') + ' km.' : ''} ${motor.description?.slice(0, 120) || 'Bekijk details en neem contact op met de dealer.'}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={`${motor.brand} ${motor.model} te koop voor ${formatPrice(motor.price)}`} />
        {images[0] && <meta property="og:image" content={images[0]} />}
        <link rel="canonical" href={`https://motoimportbv.nl/motor/${id}`} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": `${motor.brand} ${motor.model}`,
          "description": motor.description || `${motor.brand} ${motor.model} ${motor.year}`,
          "brand": { "@type": "Brand", "name": motor.brand },
          "model": motor.model,
          "productionDate": String(motor.year),
          "offers": {
            "@type": "Offer",
            "price": motor.price,
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
            "seller": {
              "@type": "Organization",
              "name": motor.dealer_company || "Moto Import B.V."
            }
          },
          ...(images[0] ? { "image": images[0] } : {})
        })}</script>
      </Helmet>

      {/* Nav */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/motoren" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-900">MOTO IMPORT</span>
          </Link>
          <Link to="/login">
            <Button variant="outline" className="text-sm" data-testid="login-btn">Inloggen</Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link to="/motoren" className="inline-flex items-center gap-2 text-zinc-500 hover:text-red-600 text-sm mb-6 transition-colors" data-testid="back-to-listing">
          <ChevronLeft className="w-4 h-4" /> Terug naar overzicht
        </Link>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Images */}
          <div className="lg:col-span-3">
            <div className="aspect-[4/3] bg-zinc-100 rounded-2xl overflow-hidden relative">
              {images.length > 0 ? (
                <img src={images[selectedImage]} alt={`${motor.brand} ${motor.model}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Bike className="w-24 h-24 text-zinc-300" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${i === selectedImage ? 'border-red-600' : 'border-transparent hover:border-zinc-300'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 sticky top-24">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {motor.brand} {motor.model}
              </h1>
              <p className="text-3xl font-black text-red-600 mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {formatPrice(motor.price)}
              </p>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-zinc-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1"><Calendar className="w-3 h-3" />Bouwjaar</div>
                  <p className="font-bold text-zinc-900">{motor.year}</p>
                </div>
                {motor.mileage > 0 && (
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1"><Gauge className="w-3 h-3" />Km-stand</div>
                    <p className="font-bold text-zinc-900">{motor.mileage.toLocaleString('nl-NL')} km</p>
                  </div>
                )}
                {motor.color && (
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1"><Palette className="w-3 h-3" />Kleur</div>
                    <p className="font-bold text-zinc-900">{motor.color}</p>
                  </div>
                )}
                {motor.condition && (
                  <div className="bg-zinc-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1"><Eye className="w-3 h-3" />Conditie</div>
                    <p className="font-bold text-zinc-900">{motor.condition}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {motor.description && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Omschrijving</h3>
                  <p className="text-sm text-zinc-700 leading-relaxed">{motor.description}</p>
                </div>
              )}

              {/* Dealer Info - Always visible */}
              <div className="mt-6 pt-6 border-t border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Dealer Informatie</h3>
                <div className="space-y-2.5" data-testid="dealer-info">
                  {motor.dealer_company && (
                    <div className="flex items-center gap-2 text-sm text-zinc-800">
                      <Building2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="font-semibold">{motor.dealer_company}</span>
                    </div>
                  )}
                  {motor.dealer_contact_person && (
                    <div className="flex items-center gap-2 text-sm text-zinc-700">
                      <User className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>{motor.dealer_contact_person}</span>
                    </div>
                  )}
                  {motor.dealer_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <a href={`mailto:${motor.dealer_email}`} className="text-red-600 font-semibold hover:underline">{motor.dealer_email}</a>
                    </div>
                  )}
                  {motor.dealer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <a href={`tel:${motor.dealer_phone}`} className="text-red-600 font-semibold hover:underline">{motor.dealer_phone}</a>
                    </div>
                  )}
                  {motor.dealer_city && (
                    <div className="flex items-center gap-2 text-sm text-zinc-700">
                      <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>{motor.dealer_city}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Interest Form */}
              <div className="mt-6 pt-6 border-t border-zinc-100">
                {!showInterestForm && !sent ? (
                  <Button
                    onClick={() => setShowInterestForm(true)}
                    data-testid="show-interest-btn"
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-base font-bold rounded-xl transition-all hover:scale-[1.02]"
                  >
                    <Send className="w-5 h-5 mr-2" /> Ik heb interesse
                  </Button>
                ) : sent ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center" data-testid="interest-sent">
                    <p className="text-green-800 font-bold">Uw interesse is verstuurd!</p>
                    <p className="text-green-700 text-sm mt-1">U wordt zo snel mogelijk teruggebeld.</p>
                  </div>
                ) : (
                  <form onSubmit={handleInterestSubmit} className="space-y-3" data-testid="interest-form">
                    <h3 className="text-sm font-bold text-zinc-700">Interesse? Laat uw gegevens achter</h3>
                    <input
                      type="text"
                      placeholder="Uw naam"
                      value={interestForm.name}
                      onChange={(e) => setInterestForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid="interest-name"
                    />
                    <input
                      type="email"
                      placeholder="Uw email"
                      value={interestForm.email}
                      onChange={(e) => setInterestForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid="interest-email"
                    />
                    <input
                      type="tel"
                      placeholder="Uw telefoonnummer"
                      value={interestForm.phone}
                      onChange={(e) => setInterestForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid="interest-phone"
                    />
                    <textarea
                      placeholder="Bericht (optioneel)"
                      value={interestForm.message}
                      onChange={(e) => setInterestForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      rows={2}
                      data-testid="interest-message"
                    />
                    <Button type="submit" disabled={sending} className="w-full bg-red-600 hover:bg-red-700 text-white" data-testid="send-interest-btn">
                      {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Verstuur
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-400 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>Moto Import B.V. · +31 6 24264861 · motoimportbv@gmail.com</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/motoren" className="hover:text-white transition-colors">Alle motoren</Link>
            <Link to="/suppliers" className="hover:text-white transition-colors">Leveranciers</Link>
            <Link to="/dealers" className="hover:text-white transition-colors">Dealers</Link>
            <Link to="/particulier-verkopen" className="hover:text-white transition-colors">Motor verkopen</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
