import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, ChevronDown, ArrowRight, Loader2 } from 'lucide-react';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nieuwste eerst' },
  { value: 'price_low', label: 'Prijs: laag → hoog' },
  { value: 'price_high', label: 'Prijs: hoog → laag' },
  { value: 'year_new', label: 'Bouwjaar: nieuw → oud' },
];

export default function MotoDirectCatalog() {
  const [motorcycles, setMotorcycles] = useState([]);
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', min_price: '', max_price: '', sort: 'newest' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const params = { limit: 60, sort: filters.sort };
      if (filters.brand) params.brand = filters.brand;
      if (filters.min_price) params.min_price = filters.min_price;
      if (filters.max_price) params.max_price = filters.max_price;
      const res = await axios.get(`${API}/motodirect/catalog`, { params });
      setMotorcycles(res.data.motorcycles || []);
      setBrands(res.data.brands || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalog(); }, [filters]);

  const formatPrice = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

  return (
    <MotoDirectLayout>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-24">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-2">Catalogus</div>
            <h1 className="heading text-4xl md:text-5xl font-bold text-white leading-tight">
              {total > 0 ? `${total} motoren` : 'Beschikbare motoren'}
            </h1>
            <p className="text-neutral-400 mt-2">Direct beschikbaar tegen dealerprijs. Wekelijks nieuwe aanvoer.</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            data-testid="mobile-filter-toggle"
            className="md:hidden inline-flex items-center gap-2 border border-neutral-700 text-white px-4 py-2 text-sm"
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar filters */}
          <aside className={`${showFilters ? 'block' : 'hidden'} md:block sticky top-24 self-start`} data-testid="filter-sidebar">
            <div className="border border-[#1c1c1c] p-6 space-y-6">
              {/* Brand */}
              <div>
                <label className="text-xs uppercase tracking-widest text-neutral-500 mb-3 block">Merk</label>
                <select
                  value={filters.brand}
                  onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                  data-testid="filter-brand"
                  className="w-full bg-[#0a0a0a] border border-neutral-800 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#0047FF]"
                >
                  <option value="">Alle merken</option>
                  {brands.map(b => (
                    <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                  ))}
                </select>
              </div>
              {/* Price */}
              <div>
                <label className="text-xs uppercase tracking-widest text-neutral-500 mb-3 block">Prijs (€)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.min_price}
                    onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
                    data-testid="filter-min-price"
                    className="bg-[#0a0a0a] border border-neutral-800 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#0047FF]"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.max_price}
                    onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                    data-testid="filter-max-price"
                    className="bg-[#0a0a0a] border border-neutral-800 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#0047FF]"
                  />
                </div>
              </div>
              {/* Sort */}
              <div>
                <label className="text-xs uppercase tracking-widest text-neutral-500 mb-3 block">Sorteer</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  data-testid="filter-sort"
                  className="w-full bg-[#0a0a0a] border border-neutral-800 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#0047FF]"
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {(filters.brand || filters.min_price || filters.max_price) && (
                <button
                  onClick={() => setFilters({ brand: '', min_price: '', max_price: '', sort: 'newest' })}
                  data-testid="reset-filters"
                  className="text-xs text-neutral-400 hover:text-white underline"
                >
                  Filters resetten
                </button>
              )}
            </div>
          </aside>

          {/* Grid */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 text-[#0047FF] animate-spin" />
              </div>
            ) : motorcycles.length === 0 ? (
              <div className="text-center py-24 text-neutral-400" data-testid="empty-state">
                <p>Geen motoren gevonden met deze filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="motorcycle-grid">
                {motorcycles.map(m => (
                  <Link
                    key={m.id}
                    to={`/motodirect/motor/${m.id}`}
                    data-testid={`motor-card-${m.id}`}
                    className="group block bg-[#0a0a0a] border border-[#1c1c1c] hover:border-[#0047FF] transition-all overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-neutral-900 overflow-hidden">
                      {m.images?.[0] ? (
                        <img
                          src={m.images[0]}
                          alt={`${m.brand} ${m.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700">Geen foto</div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-neutral-500">{m.brand}</div>
                          <h3 className="heading text-lg font-bold text-white leading-tight mt-0.5">{m.model}</h3>
                        </div>
                        <div className="text-xs text-neutral-400">{m.year}</div>
                      </div>
                      <div className="pt-4 border-t border-[#1c1c1c] flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-[#0047FF]">All-in prijs</div>
                          <div className="heading text-2xl font-bold text-white">{formatPrice(m.price)}</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-neutral-600 group-hover:text-[#0047FF] group-hover:translate-x-1 transition-all" />
                      </div>
                      {m.mileage > 0 && (
                        <div className="text-xs text-neutral-500 mt-3">{new Intl.NumberFormat('nl-NL').format(m.mileage)} km</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MotoDirectLayout>
  );
}
