import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, Shield, Wallet, Truck, Calendar, Gauge, Palette, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectMotorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [motor, setMotor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [reserving, setReserving] = useState(false);
  const [keuringChoice, setKeuringChoice] = useState('motodirect');
  const [includeTaxatie, setIncludeTaxatie] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/motodirect/catalog/${id}`);
        if (mounted) setMotor(res.data);
      } catch (e) {
        toast.error('Motor niet gevonden of niet meer beschikbaar');
        navigate('/motodirect/catalog');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, navigate]);

  const formatPrice = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

  const handleReserve = async () => {
    const token = localStorage.getItem('motodirect_token');
    if (!token) {
      // Store intent and go to register
      localStorage.setItem('motodirect_intent', JSON.stringify({ action: 'reserve', motorcycle_id: id }));
      navigate('/motodirect/register');
      return;
    }
    setReserving(true);
    try {
      const origin_url = window.location.origin;
      const res = await axios.post(
        `${API}/motodirect/checkout`,
        {
          motorcycle_id: id,
          origin_url,
          keuring_choice: keuringChoice,
          include_taxatie: includeTaxatie,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.checkout_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Kon reservering niet starten');
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <MotoDirectLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-10 h-10 text-[#0047FF] animate-spin" />
        </div>
      </MotoDirectLayout>
    );
  }
  if (!motor) return null;

  return (
    <MotoDirectLayout>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-8 pb-24">
        <Link to="/motodirect/catalog" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white text-sm mb-8" data-testid="back-to-catalog">
          <ArrowLeft className="w-4 h-4" /> Terug naar catalogus
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
          {/* Gallery + specs */}
          <div>
            <div className="aspect-[4/3] bg-neutral-900 border border-[#1c1c1c] overflow-hidden mb-4">
              {motor.images?.[activeImage] ? (
                <img
                  src={motor.images[activeImage]}
                  alt={`${motor.brand} ${motor.model}`}
                  className="w-full h-full object-cover"
                  data-testid="main-image"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-700">Geen foto beschikbaar</div>
              )}
            </div>
            {motor.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-3 mb-10">
                {motor.images.slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    data-testid={`thumb-${i}`}
                    className={`aspect-square overflow-hidden border-2 transition-colors ${activeImage === i ? 'border-[#0047FF]' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Specs bento */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" data-testid="specs-grid">
              <SpecCard icon={Calendar} label="Bouwjaar" value={motor.year} />
              <SpecCard icon={Gauge} label="Km-stand" value={motor.mileage ? `${new Intl.NumberFormat('nl-NL').format(motor.mileage)} km` : '—'} />
              <SpecCard icon={Palette} label="Kleur" value={motor.color || '—'} />
              <SpecCard icon={CheckCircle2} label="Staat" value={motor.condition || 'Goed'} />
            </div>

            {motor.description && (
              <div className="border-t border-[#1c1c1c] pt-8">
                <h3 className="heading text-2xl font-bold text-white mb-4">Omschrijving</h3>
                <p className="text-neutral-300 leading-relaxed whitespace-pre-line">{motor.description}</p>
              </div>
            )}
          </div>

          {/* Sticky reservation widget */}
          <aside className="lg:sticky lg:top-24 self-start space-y-6" data-testid="reserve-widget">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-2">{motor.brand}</div>
              <h1 className="heading text-4xl font-bold text-white leading-tight">{motor.model}</h1>
              <div className="text-sm text-neutral-400 mt-2">{motor.year} · {motor.mileage ? `${new Intl.NumberFormat('nl-NL').format(motor.mileage)} km` : 'Nieuw'}</div>
            </div>

            <div className="bg-white text-black p-6">
              {motor.dealer_reference_price > motor.price && (
                <div className="bg-[#00FF66]/15 border-l-4 border-[#00FF66] px-3 py-2 mb-4 flex items-baseline justify-between" data-testid="savings-banner">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-black">Jij bespaart</span>
                  <span className="heading text-xl font-bold text-black">{formatPrice(motor.savings)}</span>
                </div>
              )}

              {motor.dealer_reference_price > motor.price && (
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm text-neutral-500 line-through">{formatPrice(motor.dealer_reference_price)}</span>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">vergelijkbaar bij dealer</span>
                </div>
              )}
              <div className="text-[10px] uppercase tracking-widest text-[#0047FF] font-semibold mb-1">Onze prijs</div>
              <div className="heading text-4xl font-bold leading-none">{formatPrice(motor.price)}</div>
              <div className="text-xs text-neutral-500 mt-1">All-in prijs, geen verborgen kosten</div>

              {/* RDW keuring keuze */}
              <div className="border-t border-neutral-200 mt-5 pt-5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-3">RDW-keuring — kies wie</div>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${keuringChoice === 'motodirect' ? 'border-[#0047FF] bg-[#0047FF]/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                    <input
                      type="radio"
                      name="keuring"
                      value="motodirect"
                      checked={keuringChoice === 'motodirect'}
                      onChange={() => setKeuringChoice('motodirect')}
                      data-testid="keuring-motodirect"
                      className="mt-1 accent-[#0047FF]"
                    />
                    <div className="text-xs flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-black">Moto-direct regelt keuring</span>
                        <span className="text-black font-semibold">{formatPrice(motor.keuring_fee || 125)}</span>
                      </div>
                      <div className="text-neutral-500 mt-0.5">Wij regelen de RDW-keuring bij ons keurings­station</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${keuringChoice === 'self' ? 'border-[#0047FF] bg-[#0047FF]/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                    <input
                      type="radio"
                      name="keuring"
                      value="self"
                      checked={keuringChoice === 'self'}
                      onChange={() => setKeuringChoice('self')}
                      data-testid="keuring-self"
                      className="mt-1 accent-[#0047FF]"
                    />
                    <div className="text-xs flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-black">Ik keur zelf</span>
                        <span className="text-neutral-500 text-[11px]">Op eigen rekening</span>
                      </div>
                      <div className="text-neutral-500 mt-0.5">Je regelt de RDW-keuring zelf na aflevering</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Taxatie optie */}
              <div className="border-t border-neutral-200 mt-5 pt-5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-3">Extra service</div>
                <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${includeTaxatie ? 'border-[#0047FF] bg-[#0047FF]/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                  <input
                    type="checkbox"
                    checked={includeTaxatie}
                    onChange={(e) => setIncludeTaxatie(e.target.checked)}
                    data-testid="include-taxatie"
                    className="mt-1 accent-[#0047FF]"
                  />
                  <div className="text-xs flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-black">Taxatie voor BPM-vermindering</span>
                      <span className="text-black font-semibold">+{formatPrice(motor.taxatie_fee || 160)}</span>
                    </div>
                    <div className="text-neutral-500 mt-0.5">Officiële taxatie waarmee je minder BPM betaalt</div>
                  </div>
                </label>
              </div>

              {/* Kostenoverzicht */}
              <div className="border-t border-neutral-200 mt-5 pt-5 space-y-2 text-sm">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Motor</span>
                  <span>{formatPrice(motor.price)}</span>
                </div>
                {keuringChoice === 'motodirect' && (
                  <div className="flex items-center justify-between text-xs text-neutral-500" data-testid="keuring-line">
                    <span>RDW-keuring</span>
                    <span>+{formatPrice(motor.keuring_fee || 125)}</span>
                  </div>
                )}
                {includeTaxatie && (
                  <div className="flex items-center justify-between text-xs text-neutral-500" data-testid="taxatie-line">
                    <span>Taxatie BPM</span>
                    <span>+{formatPrice(motor.taxatie_fee || 160)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 font-semibold">
                  <span>Totaal</span>
                  <span data-testid="total-price">{formatPrice((motor.price || 0) + (keuringChoice === 'motodirect' ? (motor.keuring_fee || 125) : 0) + (includeTaxatie ? (motor.taxatie_fee || 160) : 0))}</span>
                </div>
                {(() => {
                  const extras = (keuringChoice === 'motodirect' ? (motor.keuring_fee || 125) : 0) + (includeTaxatie ? (motor.taxatie_fee || 160) : 0);
                  const deposit = (motor.deposit_amount || 0) + extras;
                  const total = (motor.price || 0) + extras;
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs text-neutral-600 pt-2">
                        <span>Aanbetaling nu (35% + extras)</span>
                        <span className="font-semibold text-black" data-testid="deposit-amount">{formatPrice(deposit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>Restant bij aflevering</span>
                        <span>{formatPrice(total - deposit)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <button
                onClick={handleReserve}
                disabled={reserving}
                data-testid="reserve-motor-button"
                className="mt-6 w-full bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold py-4 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {reserving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reserveer nu — 35% aanbetaling'}
              </button>
              <div className="text-[11px] text-neutral-500 text-center mt-3">Veilig betalen via iDEAL of creditcard (Stripe)</div>
            </div>

            <div className="border border-[#1c1c1c] p-5 space-y-3 text-sm">
              <TrustRow icon={Shield} text="Geverifieerd via BSN — direct RDW-registratie" />
              <TrustRow icon={Truck} text="Wekelijkse import — kort levertijd" />
              <TrustRow icon={Wallet} text="Restant pas bij aflevering" />
            </div>
          </aside>
        </div>
      </div>
    </MotoDirectLayout>
  );
}

function SpecCard({ icon: Icon, label, value }) {
  return (
    <div className="border border-[#1c1c1c] p-4">
      <Icon className="w-4 h-4 text-[#0047FF] mb-2" strokeWidth={1.5} />
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-white font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}

function TrustRow({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-[#00FF66] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
      <span className="text-neutral-300 text-xs leading-relaxed">{text}</span>
    </div>
  );
}
