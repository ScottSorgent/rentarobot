import { ArrowLeft, CalendarDays, Search, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { Booking } from '@/lib/types';
import { formatMoney } from '@/lib/types';

interface Props {
  bookings: Booking[];
  loading: boolean;
  searched: boolean;
  error: string | null;
  onBack: () => void;
  onSearch: (email: string) => void;
  onBrowse: () => void;
}

const statusStyles: Record<Booking['status'], { label: string; classes: string }> = {
  pending: { label: 'Pending confirmation', classes: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', classes: 'bg-brand-100 text-brand-800' },
  completed: { label: 'Completed', classes: 'bg-ink-200 text-ink-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-700' },
};

export default function BookingsPage({ bookings, loading, searched, error, onBack, onSearch, onBrowse }: Props) {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft size={18} /> Back to fleet
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight">My bookings</h1>
        <p className="text-ink-500 mt-2">
          Enter the email you used when booking to see your rentals and their status.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) onSearch(email);
          }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Search size={17} />
            {loading ? 'Looking up...' : 'Find bookings'}
          </button>
        </form>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            Lookup failed: {error}
          </div>
        )}

        {searched && !loading && !error && bookings.length === 0 && (
          <div className="mt-10 text-center bg-white rounded-2xl border border-ink-100 py-16 px-6">
            <XCircle size={36} className="mx-auto text-ink-300" />
            <p className="mt-4 font-semibold text-ink-900">No bookings found for that email</p>
            <p className="text-sm text-ink-500 mt-1">Double-check the address, or make your first rental.</p>
            <button
              onClick={onBrowse}
              className="mt-6 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Browse robots
            </button>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-medium text-ink-500">
              {bookings.length} booking{bookings.length > 1 ? 's' : ''} found
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
                      <h3 className="font-display font-semibold">{robot ? robot.name : 'Robot rental'}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.classes}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500 inline-flex items-center gap-2">
                      <CalendarDays size={14} />
                      {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' → '}
                      {new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span aria-hidden>·</span>
                      {b.days} day{b.days > 1 ? 's' : ''}
                      <span aria-hidden>·</span>
                      <span className="capitalize">{b.usage_type}</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-display font-bold text-lg">{formatMoney(b.total_price)}</p>
                    <p className="text-xs text-ink-400">Booking #{b.id.slice(0, 8)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
