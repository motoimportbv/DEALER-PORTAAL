import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Bike, Calendar, Gauge, Palette, ChevronLeft, ChevronRight, X, ZoomIn, Wrench, Info, MapPin, Phone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerMotorView() {
  const { id } = useParams();
  const [motor, setMotor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const fetchMotor = async () => {
      try {
        const res = await axios.get(`${API}/motorcycles/${id}/customer-share`);
        setMotor(res.data);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    fetchMotor();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !motor) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center">
        <Bike className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-zinc-800">Motor niet gevonden</h1>
        <p className="text-zinc-500 mt-2">Deze motor is niet meer beschikbaar.</p>
      </div>
    </div>
  );

  const images = motor.images || [];
  const nextImage = () => setSelectedImage(p => (p + 1) % images.length);
  const prevImage = () => setSelectedImage(p => (p - 1 + images.length) % images.length);

  const specs = [
    { icon: Calendar, label: 'Bouwjaar', value: motor.year },
    { icon: Gauge, label: 'Km-stand', value: motor.mileage ? `${motor.mileage.toLocaleString('nl-NL')} km` : '-' },
    { icon: Palette, label: 'Kleur', value: motor.color || '-' },
    { icon: Wrench, label: 'Conditie', value: motor.condition || '-' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="customer-motor-view">
      {/* Header */}
      <header className="bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">MOTO IMPORT</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            {images.length > 0 ? (
              <div className="space-y-3">
                <div className="relative aspect-[4/3] bg-zinc-200 rounded-2xl overflow-hidden group cursor-pointer" onClick={() => setLightboxOpen(true)} data-testid="main-image">
                  <img src={images[selectedImage]} alt={`${motor.brand} ${motor.model}`} className="w-full h-full object-cover" />
                  {images.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); prevImage(); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={e => { e.stopPropagation(); nextImage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5" /></button>
                    </>
                  )}
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">{selectedImage + 1} / {images.length}</div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((img, i) => (
                      <button key={i} onClick={() => setSelectedImage(i)}
                        className={`w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === selectedImage ? 'border-red-600 ring-2 ring-red-600/30' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[4/3] bg-zinc-200 rounded-2xl flex items-center justify-center">
                <Bike className="w-20 h-20 text-zinc-300" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <p className="text-sm font-bold text-red-600 uppercase tracking-wider">{motor.brand}</p>
              <h1 className="text-3xl font-black tracking-tight mt-1" data-testid="motor-title" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {motor.brand} {motor.model}
              </h1>
              {motor.chassis_number && (
                <p className="text-sm text-zinc-500 font-mono mt-1">{motor.chassis_number}</p>
              )}
            </div>

            {/* Info banner */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3" data-testid="info-banner">
              <Info className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Interesse in deze motor?</p>
                <p className="text-sm text-red-700 mt-0.5">Neem contact op met uw dealer voor beschikbaarheid en prijs.</p>
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3">
              {specs.map((s, i) => (
                <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <s.icon className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">{s.label}</p>
                    <p className="font-bold text-sm">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            {motor.description && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500 mb-2">Beschrijving</h3>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{motor.description}</p>
              </div>
            )}

            {/* Extra info */}
            {(motor.has_maintenance_history || motor.maintenance_history_details) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800">Onderhoudshistorie beschikbaar</p>
                {motor.maintenance_history_details && <p className="text-sm text-green-700 mt-1">{motor.maintenance_history_details}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center border-t pt-8 pb-4">
          <p className="text-sm text-zinc-400">Moto Import B.V. | KVK: 94622086</p>
          <p className="text-xs text-zinc-400 mt-1">Voor prijsinformatie kunt u contact opnemen met uw dealer.</p>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20" onClick={() => setLightboxOpen(false)}><X className="w-5 h-5" /></button>
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20"><ChevronLeft className="w-6 h-6" /></button>
              <button onClick={e => { e.stopPropagation(); nextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20"><ChevronRight className="w-6 h-6" /></button>
            </>
          )}
          <img src={images[selectedImage]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">{selectedImage + 1} / {images.length}</div>
        </div>
      )}
    </div>
  );
}
