import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/button';
import { Bike, ChevronLeft, Calendar, Gauge, MapPin, Palette, Phone, Mail, User, ArrowRight, Eye } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

export default function PublicMotorDetail() {
  const { id } = useParams();
  const [motor, setMotor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const fetchMotor = async () => {
      try {
        const res = await fetch(`${API}/api/public/motors/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMotor(data);
        }
      } catch { /* */ }
      setLoading(false);
    };
    fetchMotor();
  }, [id]);

  const handleRevealContact = async () => {
    setContactLoading(true);
    try {
      const res = await fetch(`${API}/api/public/motors/${id}/contact`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setContact(data);
        setShowContact(true);
      }
    } catch { /* */ }
    setContactLoading(false);
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
        <meta name="description" content={`${motor.brand} ${motor.model} (${motor.year}) te koop voor ${formatPrice(motor.price)}. ${motor.mileage ? motor.mileage.toLocaleString('nl-NL') + ' km.' : ''} ${motor.description?.slice(0, 120) || 'Bekijk alle details en neem contact op.'}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={`${motor.brand} ${motor.model} te koop voor ${formatPrice(motor.price)}`} />
        {images[0] && <meta property="og:image" content={images[0]} />}
        <link rel="canonical" href={`https://motoimportbv.nl/motor/${id}`} />
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
            "seller": { "@type": "Organization", "name": "Moto Import B.V." }
          },
          ...(images[0] ? { "image": images[0] } : {})
        })}</script>
      </Helmet>

      {/* Nav */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-900">MOTO IMPORT</span>
          </Link>
          <Link to="/login">
            <Button variant="outline" className="text-sm">Inloggen</Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
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
              <span className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full ${
                motor.type === 'particulier' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {motor.type === 'particulier' ? 'Particulier' : 'Dealer'}
              </span>
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === selectedImage ? 'border-red-600' : 'border-transparent hover:border-zinc-300'
                    }`}
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

              {/* Contact button */}
              <div className="mt-6 pt-6 border-t border-zinc-100">
                {!showContact ? (
                  <Button
                    onClick={handleRevealContact}
                    disabled={contactLoading}
                    data-testid="reveal-contact-btn"
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-base font-bold rounded-xl transition-all hover:scale-[1.02]"
                  >
                    {contactLoading ? 'Laden...' : <><Phone className="w-5 h-5 mr-2" /> Neem contact op</>}
                  </Button>
                ) : contact && (
                  <div className="space-y-3 bg-green-50 border border-green-200 rounded-xl p-5" data-testid="contact-info">
                    <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider">Contactgegevens</h3>
                    {contact.name && (
                      <div className="flex items-center gap-2 text-sm text-zinc-800">
                        <User className="w-4 h-4 text-green-600" /><span className="font-semibold">{contact.name}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-green-600" />
                        <a href={`tel:${contact.phone}`} className="text-red-600 font-semibold hover:underline">{contact.phone}</a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-green-600" />
                        <a href={`mailto:${contact.email}`} className="text-red-600 font-semibold hover:underline">{contact.email}</a>
                      </div>
                    )}
                    {contact.city && (
                      <div className="flex items-center gap-2 text-sm text-zinc-700">
                        <MapPin className="w-4 h-4 text-green-600" /><span>{contact.city}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sell CTA */}
              <div className="mt-4 text-center">
                <Link to="/particulier-verkopen" className="text-sm text-zinc-500 hover:text-red-600 transition-colors">
                  Ook uw motor verkopen? <ArrowRight className="w-3 h-3 inline ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
