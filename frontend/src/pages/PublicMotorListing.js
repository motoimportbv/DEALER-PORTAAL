import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bike, Search, SlidersHorizontal, ChevronDown, MapPin, Calendar, Gauge, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

const slugify = (brand, model, year) => {
  const str = `${brand} ${model} ${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return str;
};

export default function PublicMotorListing() {
  const [motors, setMotors] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const selectedBrand = searchParams.get('merk') || '';
  const sortBy = searchParams.get('sort') || 'newest';

  const fetchMotors = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/api/public/motors?sort_by=${sortBy}`;
      if (selectedBrand) url += `&brand=${encodeURIComponent(selectedBrand)}`;
      const res = await fetch(url);
      const data = await res.json();
      setMotors(data);
    } catch { /* */ }
    setLoading(false);
  }, [selectedBrand, sortBy]);

  useEffect(() => {
    fetchMotors();
    fetch(`${API}/api/public/motors/brands`).then(r => r.json()).then(setBrands).catch(() => {});
  }, [fetchMotors]);

  const updateFilter = (key, val) => {
    const params = new URLSearchParams(searchParams);
    if (val) params.set(key, val); else params.delete(key);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="public-motor-listing">
      <Helmet>
        <title>{selectedBrand ? `${selectedBrand} Motoren Te Koop` : 'Motoren Te Koop'} | Moto Import BV</title>
        <meta name="description" content={`Bekijk ${motors.length}+ motoren te koop bij Moto Import BV. ${selectedBrand || 'Alle merken'}: BMW, Ducati, Honda, Kawasaki, Yamaha en meer. Direct van dealer of particulier.`} />
        <link rel="canonical" href={`https://motoimportbv.nl/motoren${selectedBrand ? `?merk=${selectedBrand}` : ''}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Motoren Te Koop - Moto Import BV",
          "numberOfItems": motors.length,
          "itemListElement": motors.slice(0, 10).map((m, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "Product",
              "name": `${m.brand} ${m.model}`,
              "offers": { "@type": "Offer", "price": m.price, "priceCurrency": "EUR" }
            }
          }))
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
          <div className="flex items-center gap-3">
            <Link to="/particulier-verkopen" className="text-sm text-zinc-500 hover:text-red-600 transition-colors hidden sm:block">Motor verkopen?</Link>
            <Link to="/login">
              <Button variant="outline" className="text-sm">Inloggen</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {selectedBrand ? `${selectedBrand} Motoren` : 'Motoren Te Koop'}
          </h1>
          <p className="text-zinc-500 mt-2">{motors.length} motor{motors.length !== 1 ? 'en' : ''} beschikbaar van dealers en particulieren</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="text-sm" onClick={() => setShowFilters(!showFilters)} data-testid="filter-toggle">
            <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <select
            value={selectedBrand}
            onChange={(e) => updateFilter('merk', e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-red-500 focus:outline-none"
            data-testid="brand-filter"
          >
            <option value="">Alle merken</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-red-500 focus:outline-none"
            data-testid="sort-select"
          >
            <option value="newest">Nieuwste eerst</option>
            <option value="price_low">Prijs laag → hoog</option>
            <option value="price_high">Prijs hoog → laag</option>
          </select>
          {selectedBrand && (
            <button onClick={() => updateFilter('merk', '')} className="text-sm text-red-600 hover:text-red-700 font-medium">
              Filter wissen
            </button>
          )}
        </div>
      </div>

      {/* Motor Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : motors.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
            <h2 className="text-xl font-bold text-zinc-700 mb-2">Geen motoren gevonden</h2>
            <p className="text-zinc-500 mb-4">Probeer een ander filter of kom later terug</p>
            {selectedBrand && (
              <Button onClick={() => updateFilter('merk', '')} variant="outline">Alle motoren bekijken</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {motors.map((m) => (
              <Link
                to={`/motor/${m.id}/${slugify(m.brand, m.model, m.year)}`}
                key={m.id}
                className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:border-red-300 hover:shadow-lg transition-all duration-300"
                data-testid={`motor-card-${m.id}`}
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                  {m.images && m.images.length > 0 ? (
                    <img src={m.images[0]} alt={`${m.brand} ${m.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bike className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                  <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full ${
                    m.type === 'particulier' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {m.type === 'particulier' ? 'Particulier' : 'Dealer'}
                  </span>
                </div>
                {/* Content */}
                <div className="p-4">
                  <h2 className="font-bold text-zinc-900 text-lg leading-tight group-hover:text-red-600 transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {m.brand} {m.model}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.year}</span>
                    {m.mileage > 0 && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{m.mileage.toLocaleString('nl-NL')} km</span>}
                    {m.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.city}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{formatPrice(m.price)}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-red-600 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>Moto Import B.V. · +31 6 24264861 · motoimportbv@gmail.com</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/suppliers" className="hover:text-white transition-colors">Leveranciers</Link>
            <Link to="/dealers" className="hover:text-white transition-colors">Dealers</Link>
            <Link to="/particulier-verkopen" className="hover:text-white transition-colors">Motor verkopen</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
