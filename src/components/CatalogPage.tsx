import { useState } from 'react';
import { Bot, Building2, Home } from 'lucide-react';
import type { Robot } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import AppHeader from '@/components/AppHeader';

interface Props {
  robots: Robot[];
  loading: boolean;
  error: string | null;
  userEmail: string;
  onOpenRobot: (robot: Robot) => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenBookings: () => void;
}

const categories = [
  { id: 'all', label: 'All robots', icon: Bot },
  { id: 'commercial', label: 'Professional grade', icon: Building2 },
  { id: 'residential', label: 'Home-ready', icon: Home },
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
          <span>{robot.category === 'commercial' ? 'Professional grade' : 'Home-ready'}</span>
          <span aria-hidden>·</span>
          <span>{robot.location}</span>
        </div>
        <h3 className="font-display font-semibold text-lg text-ink-900 group-hover:text-brand-700 transition-colors">
          {robot.name}
        </h3>
        <p className="mt-1 text-sm text-ink-500 line-clamp-2 leading-relaxed">{robot.tagline}</p>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-2xl font-display font-bold text-ink-900">{formatMoney(robot.monthly_rate)}</span>
          <span className="text-sm text-ink-500">/month</span>
          <span className="ml-auto text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5">
            Peer-to-peer lease
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CatalogPage({ robots, loading, error, userEmail, onOpenRobot, onSignOut, onGoHome, onOpenBookings }: Props) {
  const [filter, setFilter] = useState<CategoryId>('all');
  const [query, setQuery] = useState('');

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
      <AppHeader
        userEmail={userEmail}
        active="browse"
        onHome={onGoHome}
        onBrowse={() => window.scrollTo({ top: 0 })}
        onBookings={onOpenBookings}
        onSignOut={onSignOut}
      />

      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Robotic Catalog</h1>
            <p className="text-ink-500 mt-1.5">Every unit ships inspected, sanitized and ready for your next client.</p>
          </div>
          <div className="relative md:w-72">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cleaning robots, cities..."
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
            Could not load the cleaning robots: {error}
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

      <footer className="bg-ink-950 text-ink-300 pb-20 md:pb-12 mt-8">
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
