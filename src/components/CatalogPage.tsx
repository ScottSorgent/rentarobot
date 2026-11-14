import { Bot, Building2, Home, Menu, PackageCheck, ShieldCheck, Truck, X } from 'lucide-react';
import { useState } from 'react';
import type { Robot } from '@/lib/types';
import { formatMoney } from '@/lib/types';

interface Props {
  robots: Robot[];
  loading: boolean;
  error: string | null;
  onOpenRobot: (robot: Robot) => void;
}

const categories = [
  { id: 'all', label: 'All robots', icon: Bot },
  { id: 'commercial', label: 'Commercial', icon: Building2 },
  { id: 'residential', label: 'Residential', icon: Home },
] as const;

type CategoryId = (typeof categories)[number]['id'];

const statusBadge: Record<string, { label: string; classes: string }> = {
  available: { label: 'Available now', classes: 'bg-brand-100 text-brand-800' },
  rented: { label: 'On rental', classes: 'bg-amber-100 text-amber-800' },
  maintenance: { label: 'Maintenance', classes: 'bg-ink-200 text-ink-700' },
};

function RobotCard({ robot, onOpen, delay }: { robot: Robot; onOpen: (r: Robot) => void; delay: number }) {
  const badge = statusBadge[robot.status] ?? statusBadge.available;
  return (
    <button
      onClick={() => onOpen(robot)}
      style={{ animationDelay: `${delay}ms` }}
      className="group animate-fade-up text-left bg-white rounded-2xl overflow-hidden border border-ink-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={robot.image_url}
          alt={robot.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.classes}`}>
          {badge.label}
        </span>
        <span className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold text-ink-900 flex items-center gap-1">
          ★ {robot.rating.toFixed(1)}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-500 mb-1.5">
          {robot.category === 'commercial' ? <Building2 size={13} /> : <Home size={13} />}
          <span className="capitalize">{robot.category}</span>
          <span aria-hidden>·</span>
          <span>{robot.location}</span>
        </div>
        <h3 className="font-display font-semibold text-lg text-ink-900 group-hover:text-brand-700 transition-colors">
          {robot.name}
        </h3>
        <p className="mt-1 text-sm text-ink-500 line-clamp-2 leading-relaxed">{robot.tagline}</p>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-2xl font-display font-bold text-ink-900">{formatMoney(robot.daily_rate)}</span>
          <span className="text-sm text-ink-500">/day</span>
          <span className="ml-auto text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5">
            {formatMoney(robot.weekly_rate)}/week
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CatalogPage({ robots, loading, error, onOpenRobot }: Props) {
  const [filter, setFilter] = useState<CategoryId>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = robots.filter((r) => {
    const matchesCategory = filter === 'all' || r.category === filter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.tagline.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const commercialCount = robots.filter((r) => r.category === 'commercial').length;
  const residentialCount = robots.filter((r) => r.category === 'residential').length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5 shrink-0" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Bot className="text-white" size={20} />
            </span>
            <span className="font-display font-bold text-xl tracking-tight">Rent-a-Bot</span>
          </a>
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <a href="#catalog" className="px-3 py-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors">Browse robots</a>
            <a href="#how" className="px-3 py-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors">How it works</a>
            <a href="#bookings" className="px-3 py-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors">My bookings</a>
          </nav>
          <a
            href="#catalog"
            className="hidden md:inline-flex items-center gap-2 bg-ink-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-800 transition-colors"
          >
            Rent a robot
          </a>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-ink-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-ink-100 bg-white px-4 py-3 flex flex-col gap-1 text-sm font-medium animate-fade-in">
            <a href="#catalog" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-ink-700 hover:bg-ink-50">Browse robots</a>
            <a href="#how" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-ink-700 hover:bg-ink-50">How it works</a>
            <a href="#bookings" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-ink-700 hover:bg-ink-50">My bookings</a>
          </nav>
        )}
      </header>

      <section className="relative overflow-hidden bg-ink-950">
        <img
          src="https://images.pexels.com/photos/18799044/pexels-photo-18799044.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <p className="animate-fade-up inline-flex items-center gap-2 text-brand-300 text-sm font-semibold bg-brand-500/10 border border-brand-400/20 rounded-full px-3.5 py-1.5 mb-6">
            <ShieldCheck size={15} /> Insured, delivered, pickup included
          </p>
          <h1 className="animate-fade-up font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] max-w-2xl" style={{ animationDelay: '80ms' }}>
            Rent the robot you need. Skip the six-figure bill.
          </h1>
          <p className="animate-fade-up mt-5 text-lg text-ink-200 max-w-xl leading-relaxed" style={{ animationDelay: '160ms' }}>
            Humanoids for your lobby, welding arms for your shop floor, vacuums and companions for your home — by the day or the week.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <a href="#catalog" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-ink-950 font-semibold px-6 py-3.5 rounded-xl transition-colors">
              Browse the fleet <Truck size={18} />
            </a>
            <a href="#how" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 backdrop-blur transition-colors">
              How it works
            </a>
          </div>
          <dl className="animate-fade-up mt-12 grid grid-cols-3 gap-6 max-w-lg" style={{ animationDelay: '320ms' }}>
            {[
              { k: `${robots.length}+`, v: 'Robots in fleet' },
              { k: '48 h', v: 'Delivery time' },
              { k: '4.8★', v: 'Average rating' },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-2xl md:text-3xl font-bold text-white">{s.k}</dt>
                <dd className="text-sm text-ink-300 mt-0.5">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 scroll-mt-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">The fleet</h2>
            <p className="text-ink-500 mt-1.5">Every unit ships inspected, sanitized and insured.</p>
          </div>
          <div className="relative md:w-72">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search robots, cities..."
              className="w-full bg-white border border-ink-200 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar">
          {categories.map((c) => {
            const count = c.id === 'all' ? robots.length : c.id === 'commercial' ? commercialCount : residentialCount;
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  active
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300 hover:text-ink-900'
                }`}
              >
                <c.icon size={16} />
                {c.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${active ? 'bg-white/15' : 'bg-ink-100'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            Could not load the fleet: {error}
          </div>
        )}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
                <div className="aspect-[4/3] bg-ink-100 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-24 bg-ink-100 rounded animate-pulse" />
                  <div className="h-5 w-3/4 bg-ink-100 rounded animate-pulse" />
                  <div className="h-3 w-full bg-ink-100 rounded animate-pulse" />
                  <div className="h-8 w-1/2 bg-ink-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-ink-100">
            <Bot size={40} className="mx-auto text-ink-300" />
            <p className="mt-4 font-semibold text-ink-900">No robots match your search</p>
            <p className="text-sm text-ink-500 mt-1">Try a different term or clear the filters.</p>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((r, i) => (
              <RobotCard key={r.id} robot={r} onOpen={onOpenRobot} delay={Math.min(i * 60, 360)} />
            ))}
          </div>
        )}
      </section>

      <section id="how" className="bg-white border-y border-ink-100 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-center">How renting works</h2>
          <p className="text-ink-500 text-center mt-2 max-w-lg mx-auto">Three steps from browsing to a robot on your doorstep.</p>
          <div className="mt-12 grid md:grid-cols-3 gap-8 md:gap-6">
            {[
              { icon: Bot, title: 'Pick your robot', text: 'Browse commercial and residential units, compare specs and check live availability. Every listing shows honest daily and weekly pricing.' },
              { icon: PackageCheck, title: 'Book your dates', text: 'Choose your rental window and get an instant quote — weekly rates apply automatically for longer rentals. Confirmation lands in your inbox.' },
              { icon: Truck, title: 'We deliver & support', text: 'Delivery, setup and a walkthrough are included. Our support line stays open for the whole rental, and pickup is scheduled when you are done.' },
            ].map((s, i) => (
              <div key={s.title} className="relative">
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                    <s.icon className="text-brand-700" size={22} />
                  </span>
                  <span className="font-display text-4xl font-bold text-ink-100 select-none">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-ink-950 text-ink-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Bot className="text-white" size={20} />
            </span>
            <div>
              <p className="font-display font-bold text-white">Rent-a-Bot</p>
              <p className="text-xs text-ink-400">Robots for work and home, by the day.</p>
            </div>
          </div>
          <p className="text-xs text-ink-400">© 2026 Rent-a-Bot Inc. Delivery, insurance and support included on every rental.</p>
        </div>
      </footer>
    </div>
  );
}
