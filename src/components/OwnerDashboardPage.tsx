import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CalendarCheck,
  CircleDollarSign,
  Eye,
  Pencil,
  Play,
  Send,
} from 'lucide-react';
import type { Booking, ListingStatus, Robot } from '@/lib/types';
import { formatMoney, isHumanoid } from '@/lib/types';
import { fetchMyListings, fetchOwnerReservations, ownerSetListingStatus } from '@/lib/api';
import AppHeader from '@/components/AppHeader';

interface Props {
  userEmail: string;
  onBack: () => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenBookings: () => void;
  onNewListing: () => void;
  onEditListing: (robot: Robot) => void;
}

const statusLabels: Record<ListingStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
  paused: 'Paused',
  rejected: 'Not approved',
  suspended: 'Suspended',
  changes_requested: 'Changes requested',
};

const statusStyles: Record<ListingStatus, string> = {
  draft: 'bg-ink-100 text-ink-700 border-ink-200',
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  published: 'bg-green-50 text-green-800 border-green-200',
  paused: 'bg-ink-100 text-ink-600 border-ink-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  changes_requested: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function OwnerDashboardPage({
  userEmail,
  onBack,
  onSignOut,
  onGoHome,
  onOpenBookings,
  onNewListing,
  onEditListing,
}: Props) {
  const [listings, setListings] = useState<Robot[]>([]);
  const [reservations, setReservations] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [myListings, myReservations] = await Promise.all([
        fetchMyListings(),
        fetchOwnerReservations(),
      ]);
      setListings(myListings);
      setReservations(myReservations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(robot: Robot, status: ListingStatus) {
    setBusyId(robot.id);
    setError(null);
    try {
      await ownerSetListingStatus(robot.id, status);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the listing.');
    } finally {
      setBusyId(null);
    }
  }

  const lifetimeEarnings = reservations
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + Number(b.owner_payout ?? 0), 0);

  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader
        userEmail={userEmail}
        active="list"
        onHome={onGoHome}
        onBrowse={onBack}
        onList={() => window.scrollTo({ top: 0 })}
        onBookings={onOpenBookings}
        onSignOut={onSignOut}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to catalog
        </button>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Owner Dashboard</p>
            <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-ink-950">
              Your robot listings
            </h1>
          </div>
          <button
            onClick={onNewListing}
            className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            <Send size={17} /> Add another robot
          </button>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <StatCard icon={<Eye size={17} />} label="Listings" value={String(listings.length)} />
          <StatCard
            icon={<CalendarCheck size={17} />}
            label="Reservations"
            value={String(reservations.filter((b) => b.status !== 'cancelled').length)}
          />
          <StatCard
            icon={<CircleDollarSign size={17} />}
            label="Estimated earnings"
            value={formatMoney(lifetimeEarnings)}
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-white border border-ink-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-6 bg-white rounded-2xl border border-ink-100 text-center py-14 px-6">
            <p className="font-semibold text-ink-900">You haven't listed a robot yet.</p>
            <p className="mt-1 text-sm text-ink-500">List your first robot to start earning in your city.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {listings.map((robot) => {
              const status = (robot.listing_status ?? 'pending_review') as ListingStatus;
              const robotReservations = reservations.filter((b) => b.robot_id === robot.id && b.status !== 'cancelled');
              return (
                <div key={robot.id} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <img
                    src={robot.image_url}
                    alt={robot.name}
                    className="w-full sm:w-36 h-32 sm:h-auto object-cover rounded-xl border border-ink-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold text-lg text-ink-950 truncate">{robot.name}</h3>
                      <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </div>
                    {(robot.review_note ?? '').length > 0 && (
                      <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        Reviewer note: {robot.review_note}
                      </p>
                    )}
                    <p className="mt-1.5 text-sm text-ink-500">
                      {isHumanoid(robot)
                        ? `${formatMoney(Number(robot.daily_rate ?? 0))}/day`
                        : `${formatMoney(Number(robot.monthly_rate))}/month`}
                      {' · '}
                      {robotReservations.length} reservation{robotReservations.length === 1 ? '' : 's'}
                      {robotReservations.length > 0 && (
                        <> · {formatMoney(robotReservations.reduce((s, b) => s + Number(b.owner_payout ?? 0), 0))} earned</>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {status === 'published' && (
                        <StatusButton
                          icon={<Ban size={14} />}
                          label="Pause"
                          disabled={busyId === robot.id}
                          onClick={() => void changeStatus(robot, 'paused')}
                        />
                      )}
                      {status === 'paused' && (
                        <StatusButton
                          icon={<Play size={14} />}
                          label="Resume"
                          disabled={busyId === robot.id}
                          onClick={() => void changeStatus(robot, 'published')}
                        />
                      )}
                      {(status === 'draft' || status === 'changes_requested') && (
                        <StatusButton
                          icon={<Send size={14} />}
                          label="Submit"
                          disabled={busyId === robot.id}
                          onClick={() => void changeStatus(robot, 'pending_review')}
                        />
                      )}
                      <StatusButton
                        icon={<Pencil size={14} />}
                        label="Edit"
                        onClick={() => onEditListing(robot)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {reservations.filter((b) => b.status !== 'cancelled').length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">Reservations on your robots</h2>
            <div className="mt-4 space-y-2">
              {reservations
                .filter((b) => b.status !== 'cancelled')
                .map((booking) => {
                  const robot = Array.isArray(booking.robots) ? booking.robots[0] : booking.robots;
                  return (
                    <div key={booking.id} className="bg-white rounded-xl border border-ink-100 p-4 flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-semibold text-ink-900">{robot?.name ?? 'Robot'}</span>
                      <span className="text-ink-500">
                        {booking.start_date} → {booking.end_date}
                      </span>
                      <span className="ml-auto font-semibold text-green-700">
                        You earn {formatMoney(Number(booking.owner_payout ?? 0))}
                      </span>
                      <span className="text-xs text-ink-400 border border-ink-200 rounded-full px-2 py-0.5">
                        {booking.status}
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
        <span className="text-brand-700">{icon}</span> {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold text-ink-950">{value}</p>
    </div>
  );
}

function StatusButton({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 border border-ink-200 text-ink-800 hover:bg-ink-50 disabled:opacity-40 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
    >
      {icon} {label}
    </button>
  );
}
