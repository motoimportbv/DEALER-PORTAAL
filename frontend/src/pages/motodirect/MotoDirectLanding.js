import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, Wallet, CheckCircle2 } from 'lucide-react';
import MotoDirectLayout from './MotoDirectLayout';

export default function MotoDirectLanding() {
  return (
    <MotoDirectLayout>
      {/* HERO */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.pexels.com/photos/30330940/pexels-photo-30330940.jpeg"
            alt="Motorrijders op bergroute"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-32 lg:pt-32 lg:pb-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#0047FF]/10 border border-[#0047FF]/30 text-[#0047FF] text-xs uppercase tracking-widest px-3 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
              Wekelijks nieuwe motoren binnen
            </div>
            <h1 className="heading text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tight text-white">
              Direct van de<br />
              importeur.<br />
              <span className="text-[#0047FF]">Geen tussenpersoon.</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-neutral-300 max-w-2xl leading-relaxed">
              Waarom €3.000+ extra betalen bij een dealer? Koop jouw droommotor tegen <b className="text-white">importprijzen</b>, exclusief voor particulieren die verder kijken dan de showroom.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to="/motodirect/catalog"
                data-testid="hero-cta-catalog"
                className="inline-flex items-center justify-center gap-2 bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold px-8 py-4 text-base transition-all hover:-translate-y-0.5"
              >
                Bekijk motoren <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/motodirect/register"
                data-testid="hero-cta-register"
                className="inline-flex items-center justify-center gap-2 border border-neutral-700 hover:border-white text-white font-semibold px-8 py-4 text-base transition-all"
              >
                Registreer gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BRAND STORY */}
      <section className="border-y border-[#1c1c1c] bg-[#0a0a0a]" data-testid="brand-story">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-16 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-[#0047FF]" />
              Ons verhaal
            </div>
            <h2 className="heading text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[0.95] tracking-tight mb-8">
              Al jaren dé importeur<br />
              voor de motorbranche.
            </h2>
            <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
              <p>
                Al jaren leveren wij motoren aan officiële dealers en motorzaken door heel Nederland. Onze buitenlandse contacten, onze inkoopkracht en onze RDW-expertise hebben honderden motoren bij de juiste rijder gebracht — via de traditionele weg.
              </p>
              <p className="text-white">
                Maar we vonden het niet langer eerlijk dat particulieren de rekening betalen voor een tussenschakel. <b>Iedereen heeft recht op goedkope motoren, rechtstreeks van de importeur.</b>
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="border-2 border-[#0047FF] bg-[#0047FF]/5 p-10 lg:p-14">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#0047FF] mb-6">Onze missie</div>
              <blockquote className="heading text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight">
                &ldquo;Te veel betalen is<br />
                <span className="text-[#0047FF]">verleden tijd.</span>&rdquo;
              </blockquote>
              <div className="mt-10 pt-6 border-t border-[#0047FF]/20 flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-neutral-400">Nu ook voor particulieren</span>
              </div>
            </div>
            {/* Decorative corner accent */}
            <div className="absolute -top-3 -left-3 w-16 h-16 border-t-2 border-l-2 border-[#0047FF]" />
            <div className="absolute -bottom-3 -right-3 w-16 h-16 border-b-2 border-r-2 border-[#0047FF]" />
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            {
              icon: Wallet,
              title: 'Bespaar duizenden euros',
              desc: 'Onze all-in prijs is fors lager dan bij een reguliere dealer. Geen tussenpersonen, geen showroomkosten, wel dezelfde service.'
            },
            {
              icon: Shield,
              title: 'Geverifieerd via BSN',
              desc: 'Registreer met NAW en BSN. Je aankoop wordt correct op jouw naam ingevoerd bij de RDW. Direct rijklaar.'
            },
            {
              icon: Truck,
              title: 'Wekelijkse aanvoer',
              desc: 'Nieuwe motoren komen wekelijks binnen uit heel Europa. Reserveer met 35% aanbetaling, wij regelen de import.'
            },
          ].map((item, i) => (
            <div key={i} className="border-l-2 border-[#0047FF] pl-6">
              <item.icon className="w-8 h-8 text-[#0047FF] mb-4" strokeWidth={1.5} />
              <h3 className="heading text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24" data-testid="how-it-works">
        <div className="max-w-2xl mb-16">
          <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-4">Hoe werkt het</div>
          <h2 className="heading text-4xl md:text-5xl font-bold text-white leading-tight">
            Drie stappen naar<br />jouw droommotor.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Registreer', desc: 'Maak een account met je NAW-gegevens en BSN. Dit hebben we nodig om jouw motor bij de RDW te registreren.' },
            { step: '02', title: 'Kies & reserveer', desc: 'Blader door beschikbare motoren. Reserveer jouw favoriet met 35% aanbetaling via iDEAL of creditcard (Stripe).' },
            { step: '03', title: 'Wij regelen import', desc: 'Wij halen de motor uit het buitenland en zorgen voor de RDW-registratie op jouw naam. Restant betaal je bij aflevering.' },
          ].map((item, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#1c1c1c] p-8 hover:border-[#0047FF] transition-colors">
              <div className="heading text-6xl font-bold text-[#0047FF]/40 mb-6">{item.step}</div>
              <h3 className="heading text-2xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICE COMPARISON */}
      <section className="bg-[#0a0a0a] border-y border-[#1c1c1c]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-4">Voorbeeld besparing</div>
              <h2 className="heading text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                Zie het verschil.
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                Waar reguliere dealers hun marge van 20-30% bovenop de inkoopprijs plaatsen, geven wij jou een eerlijke all-in prijs zonder tussenpersonen. Simpel en transparant.
              </p>
              <Link
                to="/motodirect/catalog"
                data-testid="comparison-cta"
                className="inline-flex items-center gap-2 text-[#0047FF] hover:text-white font-semibold text-base group"
              >
                Bekijk alle voordelen <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="space-y-4">
              <div className="border border-neutral-800 p-6 opacity-60">
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Bij een reguliere dealer</div>
                <div className="flex items-baseline justify-between">
                  <span className="heading text-3xl font-bold text-white line-through">€14.995</span>
                  <span className="text-sm text-neutral-500">incl. dealermarge</span>
                </div>
              </div>
              <div className="border-2 border-[#0047FF] bg-[#0047FF]/5 p-6">
                <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" /> Via Moto-direct
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="heading text-4xl font-bold text-white">€12.000</span>
                  <span className="text-sm text-[#00FF66] font-semibold">Bespaar €2.995</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
        <h2 className="heading text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          Klaar om te besparen?
        </h2>
        <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-10">
          Bekijk direct alle beschikbare motoren. Wekelijks nieuwe aanvoer uit heel Europa.
        </p>
        <Link
          to="/motodirect/catalog"
          data-testid="footer-cta-catalog"
          className="inline-flex items-center gap-2 bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold px-10 py-5 text-lg transition-all hover:-translate-y-0.5"
        >
          Bekijk alle motoren <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </MotoDirectLayout>
  );
}
