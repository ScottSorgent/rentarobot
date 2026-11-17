import { ArrowLeft, CalendarDays, PackageOpen, Repeat } from 'lucide-react';
import { useEffect } from 'react';
import type { Booking, Robot } from '@/lib/types';
import { formatMoney } from '@/lib/types';

interface Props {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  userEmail: string;
  onBack: () => void;
  onBrowse: () => void;
  onRetry: () => void;
  onOpenHandoff: (booking: Booking, robot: Robot) => void;
}

const statusStyles: Record<Booking['status'], { label: string; classes: string }> = {
  pending: { label: 'Pending confirmation', classes: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', classes: 'bg-brand-100 text-brand-800' },
  completed: { label: 'Completed', classes: 'bg-ink-200 text-ink-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-700' },
};

export default function BookingsPage({ bookings, loading, error, userEmail, onBack, onBrowse, onRetry, onOpenHandoff }: Props) {
  useEffect(() => {
    onRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft size={18} /> Back to cleaning robots
          </button>
          <p className="text-xs text-ink-400 hidden sm:block truncate max-w-[200px]">{userEmail}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 pb-28 md:pb-14">
        <h1 className="font-display text-3xl font-bold tracking-tight">My robot plans</h1>
        <p className="text-ink-500 mt-2">All rentals on your account, newest first.</p>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm flex flex-wrap items-center gap-3">
            <span>Couldn't load your bookings: {error}</span>
            <button onClick={onRetry} className="font-semibold underline underline-offset-2">
              Retry
            </button>
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

        {!loading && !error && bookings.length === 0 && (
          <div className="mt-10 text-center bg-white rounded-2xl border border-ink-100 py-16 px-6">
            <PackageOpen size={36} className="mx-auto text-ink-300" />
            <p className="mt-4 font-semibold text-ink-900">No bookings yet</p>
            <p className="text-sm text-ink-500 mt-1">Your rentals will appear here once you reserve a cleaning robot.</p>
            <button
              onClick={onBrowse}
              className="mt-6 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Browse cleaning robots
            </button>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-medium text-ink-500">
              {bookings.length} booking{bookings.length > 1 ? 's' : ''}
            </p>
            {bookings.map((b) => {
              const robot = Array.isArray(b.robots) ? b.robots[0] : b.robots;
              const st = statusStyles[b.status] ?? statusStyles.pending;
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                  {robot && (
                    <img
                      src={robot.image_url}
                      alt={robot.name}
                      className="w-full sm:w-28 h-32 sm:h-20 object-cover rounded-xl shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold">{robot ? robot.name : 'Cleaning robot plan'}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.classes}`}>{st.label}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ink-100 text-ink-700">
                        {b.plan_type === 'lease' ? 'Monthly rental' : 'Short-term rental'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500 inline-flex flex-wrap items-center gap-2">
                      <CalendarDays size={14} />
                      {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' → '}
                      {new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span aria-hidden>·</span>
                      {b.days} day{b.days > 1 ? 's' : ''}
                      <span aria-hidden>·</span>
                      <span>{b.usage_type === 'commercial' ? 'Client homes' : 'Personal home'}</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-display font-bold text-lg">{formatMoney(b.total_price)}</p>
                    <p className="text-xs text-ink-400">Booking #{b.id.slice(0, 8)}</p>
                    {robot && b.status === 'confirmed' && (
                      <button
                        onClick={() => onOpenHandoff(b, robot)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-3 py-1.5 transition-colors"
                      >
                        <Repeat size={13} /> {b.handoff_status && b.handoff_status !== 'not_scheduled' ? 'View handoff' : 'Schedule handoff'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && error === null && bookings.length === 0 && (
          <div className="mt-6 text-center">
            <button onClick={onBrowse} className="text-sm font-semibold text-ink-500 hover:text-ink-800">
              or keep browsing cleaning robots
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
