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
  const [inspectionChoice, setInspectionChoice] = useState('motoimport');

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
        { motorcycle_id: id, origin_url, inspection_choice: inspectionChoice },
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
              <div className="text-[10px] uppercase tracking-widest text-[#0047FF] font-semibold mb-1">Prijs</div>
              <div className="heading text-4xl font-bold leading-none">{formatPrice(motor.price)}</div>
              <div className="text-xs text-neutral-500 mt-1">All-in prijs, geen verborgen kosten</div>

              {/* Inspection choice */}
              <div className="border-t border-neutral-200 mt-5 pt-5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-3">Keuring / APK — kies wie</div>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${inspectionChoice === 'motoimport' ? 'border-[#0047FF] bg-[#0047FF]/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                    <input
                      type="radio"
                      name="inspection"
                      value="motoimport"
                      checked={inspectionChoice === 'motoimport'}
                      onChange={() => setInspectionChoice('motoimport')}
                      data-testid="inspection-motoimport"
                      className="mt-1 accent-[#0047FF]"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-black">MotoImport keurt</div>
                      <div className="text-neutral-500 mt-0.5">Onze eigen garage regelt APK en RDW-registratie</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${inspectionChoice === 'motodirect' ? 'border-[#0047FF] bg-[#0047FF]/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                    <input
                      type="radio"
                      name="inspection"
                      value="motodirect"
                      checked={inspectionChoice === 'motodirect'}
                      onChange={() => setInspectionChoice('motodirect')}
                      data-testid="inspection-motodirect"
                      className="mt-1 accent-[#0047FF]"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-black">Moto-direct regelt het</div>
                      <div className="text-neutral-500 mt-0.5">Wij regelen het van A tot Z via onze partners</div>
                    </div>
                  </label>
                </div>
                <div className="text-[11px] text-neutral-500 mt-3">Beide opties inclusief — geen extra kosten</div>
              </div>

              <div className="border-t border-neutral-200 mt-5 pt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Aanbetaling (35%)</span>
                  <span className="font-semibold">{formatPrice(motor.deposit_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Restant bij aflevering</span>
                  <span>{formatPrice((motor.price || 0) - (motor.deposit_amount || 0))}</span>
                </div>
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
