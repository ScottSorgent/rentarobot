import { useEffect, useState } from 'react';
import { Bell, Bot, Building2, Home, MapPin } from 'lucide-react';
import type { Robot } from '@/lib/types';
import { formatMoney, isHumanoid } from '@/lib/types';
import { createNotifyRequest, fetchCities, lookupZip } from '@/lib/api';
import type { CityInfo } from '@/lib/types';
import AppHeader from '@/components/AppHeader';

interface Props {
  robots: Robot[];
  loading: boolean;
  error: string | null;
  userEmail: string;
  cityId: string | null;
  cityName: string | null;
  onPickCity: (cityId: string, label: string) => void;
  onOpenRobot: (robot: Robot) => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenBookings: () => void;
  onListRobot: () => void;
}

const categories = [
  { id: 'all', label: 'All robots', icon: Bot },
  { id: 'commercial', label: 'Professional grade', icon: Building2 },
  { id: 'residential', label: 'Home-ready', icon: Home },
] as const;

type CategoryId = (typeof categories)[number]['id'];

// Catalog cards show ONE rate per robot: monthly only for specialized
// cleaning robots, daily only for humanoid household robots. Availability
// status lives on the product page, not here.
function RobotCard({ robot, onOpen, delay }: { robot: Robot; onOpen: (r: Robot) => void; delay: number }) {
  const humanoid = isHumanoid(robot);
  const price = humanoid ? Number(robot.daily_rate ?? 0) : Number(robot.monthly_rate);
  const unit = humanoid ? '/day' : '/month';
  const label = humanoid ? 'Daily Rental' : 'Monthly Rental';
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
          <span className="text-2xl font-display font-bold text-ink-900">{formatMoney(price)}</span>
          <span className="text-sm text-ink-500">{unit}</span>
          <span className="ml-auto text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5">
            {label}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CatalogPage({
  robots,
  loading,
  error,
  userEmail,
  cityId,
  cityName,
  onPickCity,
  onOpenRobot,
  onSignOut,
  onGoHome,
  onOpenBookings,
  onListRobot,
}: Props) {
  const [filter, setFilter] = useState<CategoryId>('all');
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyDone, setNotifyDone] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  async function searchZip() {
    setZipError(null);
    const cleaned = zipInput.replace(/\D/g, '').slice(0, 5);
    if (cleaned.length < 5) {
      setZipError('Enter a 5-digit ZIP code.');
      return;
    }
    try {
      const matches = await lookupZip(cleaned);
      if (matches.length === 0) {
        setZipError("We don't serve that ZIP yet. Try a nearby supported city below.");
        return;
      }
      onPickCity(matches[0].city_id, `${matches[0].city_name}, ${matches[0].state_code}`);
    } catch {
      setZipError('Could not look up that ZIP. Please try again.');
    }
  }

  async function submitNotify() {
    setNotifyError(null);
    if (!cityId) return;
    try {
      await createNotifyRequest(cityId, notifyEmail);
      setNotifyDone(true);
    } catch {
      setNotifyError('Could not save your request. Please check the email and try again.');
    }
  }

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
        onList={onListRobot}
        onBookings={onOpenBookings}
        onSignOut={onSignOut}
      />

      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Robotic Catalog</h1>
            <p className="text-ink-500 mt-1.5">
              {cityName
                ? `Robots available for local pickup in ${cityName}.`
                : 'Pick your city to see robots available near you.'}
            </p>
          </div>
          <div className="md:w-96 space-y-2">
            <div className="relative">
              <input
                value={zipInput}
                onChange={(e) => { setZipInput(e.target.value); setZipError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void searchZip(); }}
                placeholder="Enter your ZIP code (e.g. 95202)"
                inputMode="numeric"
                className="w-full bg-white border border-ink-200 rounded-xl pl-10 pr-24 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <MapPin size={16} />
              </svg>
              <button
                onClick={() => void searchZip()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-ink-950 hover:bg-ink-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
              >
                Find City
              </button>
            </div>
            {zipError && <p className="text-xs text-red-700">{zipError}</p>}
            {cities.length > 0 && (
              <select
                value={cityId ?? ''}
                onChange={(e) => {
                  const city = cities.find((c) => c.city_id === e.target.value);
                  if (city) onPickCity(city.city_id, `${city.city_name}, ${city.state_code}`);
                }}
                className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              >
                <option value="">Or choose a city...</option>
                {cities.map((c) => (
                  <option key={c.city_id} value={c.city_id}>
                    {c.city_name}, {c.state_code}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {cityId && (
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
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            Could not load the robots: {error}
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

        {!loading && !error && cityId && filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-ink-100 px-6">
            <Bot size={40} className="mx-auto text-ink-300" />
            <p className="mt-4 font-semibold text-ink-900">
              No robots are currently available for rental in your city.
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Join our notification list to hear when new robots become available.
            </p>
            {notifyDone ? (
              <p className="mt-5 text-sm font-semibold text-green-700">
                You're on the list — we'll email you when a robot becomes available in {cityName}.
              </p>
            ) : (
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  onClick={() => void submitNotify()}
                  className="shrink-0 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <Bell size={15} /> Notify Me
                </button>
              </div>
            )}
            {notifyError && <p className="mt-2 text-xs text-red-700">{notifyError}</p>}
          </div>
        )}

        {!loading && !error && cityId && filtered.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((r, i) => (
                <RobotCard key={r.id} robot={r} onOpen={onOpenRobot} delay={Math.min(i * 60, 360)} />
              ))}
            </div>
          </>
        )}

        {!loading && !cityId && (
          <div className="text-center py-16 bg-white rounded-2xl border border-ink-100 px-6">
            <MapPin size={40} className="mx-auto text-brand-600" />
            <p className="mt-4 font-display text-lg font-bold text-ink-950">Where are you renting?</p>
            <p className="mt-1 text-sm text-ink-500 max-w-md mx-auto">
              Enter your ZIP code or pick your city above to see the robots available for local pickup near you.
            </p>
          </div>
        )}
      </section>

      <footer className="bg-ink-950 text-ink-300 pb-20 md:pb-12 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <p className="font-display font-bold text-white">Rent-A-Robot</p>
              <p className="text-xs text-ink-400">Rent cleaning and household robots from owners in your city.</p>
            </div>
          </div>
          <p className="text-xs text-ink-400">© 2026 Rent-A-Robot Inc. Local pickup rentals — reserve online, collect in your city.</p>
        </div>
      </footer>
    </div>
  );
}
