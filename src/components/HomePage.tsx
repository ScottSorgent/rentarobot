import { ArrowRight, Bot, CalendarCheck, MapPin, PackageCheck, Store, Wrench } from 'lucide-react';
import type { Robot, Booking } from '@/lib/types';
import AppHeader from '@/components/AppHeader';

interface Props {
  robots: Robot[];
  bookings: Booking[];
  userEmail: string;
  onBrowse: () => void;
  onOpenRobot: (robot: Robot) => void;
  onOpenBookings: () => void;
  onSignOut: () => void;
  onList: () => void;
}

export default function HomePage({ robots, bookings, userEmail, onBrowse, onOpenRobot, onOpenBookings, onSignOut, onList }: Props) {
  const activeBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length;
  const featured = robots.filter((r) => r.status === 'available').slice(0, 3);

  return (
    <div className="min-h-screen">
      <AppHeader
        userEmail={userEmail}
        active="home"
        onHome={() => window.scrollTo({ top: 0 })}
        onBrowse={onBrowse}
        onList={onList}
        onBookings={onOpenBookings}
        onSignOut={onSignOut}
      />

      <section className="relative overflow-hidden bg-ink-950">
        <img
          src="/premium-deep-clean-floor-robot.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <p className="animate-fade-up inline-flex items-center gap-2 text-brand-300 text-sm font-semibold bg-brand-500/10 border border-brand-400/20 rounded-full px-3.5 py-1.5 mb-6">
            <Store size={15} /> Pickup Only — Reserve Here, Collect from Peer
          </p>
          <h1 className="animate-fade-up font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] max-w-2xl" style={{ animationDelay: '80ms' }}>
            Premium cleaning power, on demand.
          </h1>
          <p className="animate-fade-up mt-5 text-lg text-ink-200 max-w-xl leading-relaxed" style={{ animationDelay: '160ms' }}>
            Rent premium cleaning robots for deep cleaning floors, carpets, streak-free glass, and the corners that ordinary equipment misses.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <button onClick={onBrowse} className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-ink-950 font-semibold px-6 py-3.5 rounded-xl transition-colors">
              Browse the catalog <ArrowRight size={18} />
            </button>
            <button onClick={onOpenBookings} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 backdrop-blur transition-colors">
              <CalendarCheck size={18} /> My bookings
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-center">How pickup works</h2>
          <p className="text-ink-500 text-center mt-2 max-w-lg mx-auto">Three steps from browsing to a robot in your vehicle.</p>
          <div className="mt-12 grid md:grid-cols-3 gap-8 md:gap-6">
            {[
              { icon: Bot, title: 'Pick your cleaning partner', text: 'Compare floor-care and detail-cleaning robots by size, runtime, ratings and availability, then reserve your unit online.' },
              { icon: PackageCheck, title: 'Rent or lease', text: 'Choose a short rental for a busy week or a monthly lease for dependable day-to-day work. Your quote updates instantly.' },
              { icon: Store, title: 'Pick up & get started', text: 'Reserve here, then collect the robot directly from a fellow renter through a peer-to-peer handoff — no store stop required. Every unit is inspected, sanitized and ready to work when you arrive.' },
            ].map((s, i) => (
              <div key={s.title} className="relative">
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                    <s.icon className="text-brand-700" size={22} />
                  </span>
                  <h3 className="flex-1 font-display font-semibold text-lg">{s.title}</h3>
                  <span className="font-display text-4xl font-bold text-ink-100 select-none">0{i + 1}</span>
                </div>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-100 border-b border-ink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-brand-800 text-sm font-semibold bg-brand-100 border border-brand-200 rounded-full px-3.5 py-1.5">
              <MapPin size={15} /> Featured units ready for pickup
            </span>
            <h2 className="mt-5 font-display text-3xl md:text-4xl font-bold tracking-tight max-w-md">
              Deep cleaning, corner to corner.
            </h2>
            <p className="mt-4 text-ink-600 leading-relaxed max-w-md">
              Give every client a polished finish without carrying every tool yourself. Pair high-suction floor care with edge-focused detail tools for the surfaces and corners that need extra attention.
            </p>
            <button
              onClick={onBrowse}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-800 hover:text-brand-700 transition-colors"
            >
              Explore the full catalog <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {featured.map((robot) => (
              <button
                key={robot.id}
                onClick={() => onOpenRobot(robot)}
                className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-ink-200 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <img
                  src={robot.image_url}
                  alt={robot.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <figcaption className="absolute inset-x-3 bottom-3 bg-ink-950/80 text-white backdrop-blur px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between gap-2">
                  <span className="truncate">{robot.name}</span>
                  <ArrowRight size={16} className="shrink-0" />
                </figcaption>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeBookings > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <button
            onClick={onOpenBookings}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-left transition-colors"
          >
            <span>
              <span className="font-display text-xl font-bold block">You have {activeBookings} active booking{activeBookings === 1 ? '' : 's'}</span>
              <span className="text-sm text-white/85 mt-1 block">Tap to review pickup details and rental periods.</span>
            </span>
            <Wrench size={28} className="shrink-0" />
          </button>
        </section>
      )}

      <footer className="bg-ink-950 text-ink-300 pb-20 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <p className="font-display font-bold text-white">Rent-A-Robot</p>
              <p className="text-xs text-ink-400">Cleaning robots for independent pros.</p>
            </div>
          </div>
          <p className="text-xs text-ink-400">© 2026 Rent-A-Robot Inc. Pickup-only rentals — reserve online, collect in store.</p>
        </div>
      </footer>
    </div>
  );
}
