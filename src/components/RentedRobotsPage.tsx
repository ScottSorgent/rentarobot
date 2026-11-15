import { CalendarDays, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import type { Booking, Robot } from '@/lib/types';

interface Props {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  onOpenRobot: (robot: Robot, booking: Booking) => void;
  onRetry: () => void;
  onBrowse: () => void;
}

export default function RentedRobotsPage({ bookings, loading, error, onOpenRobot, onRetry, onBrowse }: Props) {
  const rentals = useMemo(() => {
    const seen = new Set<string>();
    return bookings
      .map((b) => ({ booking: b, robot: Array.isArray(b.robots) ? b.robots[0] : b.robots }))
      .filter((entry): entry is { booking: Booking; robot: Robot } => Boolean(entry.robot))
      .filter((entry) => {
        if (seen.has(entry.robot.id)) return false;
        seen.add(entry.robot.id);
        return true;
      });
  }, [bookings]);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2.5">
          <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
          <span className="font-display font-bold text-xl tracking-tight">Rent-A-Robot</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">Robots rented</h1>
        <p className="mt-2 text-ink-500 leading-relaxed">
          Tap any robot you've rented to open its full guide: setup, mapping, maintenance, training videos, safety warnings and warranty.
        </p>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm flex flex-wrap items-center gap-3">
            <span>Couldn't load your rentals: {error}</span>
            <button onClick={onRetry} className="font-semibold underline underline-offset-2">Retry</button>
          </div>
        )}

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-ink-100 p-5 flex gap-4">
                <div className="w-28 h-20 bg-ink-100 rounded-xl animate-pulse shrink-0" />
                <div className="flex-1 space-y-2.5 py-1">
                  <div className="h-4 w-1/3 bg-ink-100 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-ink-100 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-ink-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && rentals.length === 0 && (
          <div className="mt-10 text-center bg-white rounded-2xl border border-ink-100 py-16 px-6">
            <Wrench size={36} className="mx-auto text-ink-300" />
            <p className="mt-4 font-semibold text-ink-900">No rented robots yet</p>
            <p className="text-sm text-ink-500 mt-1">Once you reserve a robot, its training and care guide will appear here.</p>
            <button onClick={onBrowse} className="mt-6 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Browse cleaning robots
            </button>
          </div>
        )}

        {!loading && rentals.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-medium text-ink-500">{rentals.length} robot{rentals.length > 1 ? 's' : ''} on your account</p>
            {rentals.map(({ booking, robot }) => (
              <button
                key={robot.id}
                onClick={() => onOpenRobot(robot, booking)}
                className="w-full text-left bg-white rounded-2xl border border-ink-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <img src={robot.image_url} alt={robot.name} className="w-full sm:w-28 h-32 sm:h-20 object-cover rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-lg text-ink-900">{robot.name}</h3>
                  <p className="mt-0.5 text-sm text-ink-500 line-clamp-1">{robot.tagline}</p>
                  <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs font-medium text-ink-600">
                    <CalendarDays size={14} />
                    {new Date(booking.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' → '}
                    {new Date(booking.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span aria-hidden>·</span>
                    {booking.plan_type === 'lease' ? 'Monthly lease' : 'Short-term rental'}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1.5 self-start sm:self-center">
                  <Wrench size={14} /> View guide
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
