import { useEffect, useState } from 'react';
import CatalogPage from '@/components/CatalogPage';
import RobotDetailPage from '@/components/RobotDetailPage';
import BookingsPage from '@/components/BookingsPage';
import { createBooking, fetchBookingsByEmail, fetchRobots } from '@/lib/api';
import type { Booking, NewBooking, Robot } from '@/lib/types';

type View = 'catalog' | 'detail' | 'bookings';

export default function App() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('catalog');
  const [selected, setSelected] = useState<Robot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastBookingEmail, setLastBookingEmail] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetchRobots()
      .then((rows) => setRobots(rows))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openRobot(robot: Robot) {
    setSelected(robot);
    setSubmitError(null);
    setView('detail');
  }

  function goCatalog() {
    setView('catalog');
    setSelected(null);
  }

  async function submitBooking(booking: NewBooking) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createBooking(booking);
      setLastBookingEmail(booking.renter_email);
      setBookings([]);
      setSearched(false);
      setView('bookings');
      await loadBookings(booking.renter_email);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadBookings(email: string) {
    setBookingsLoading(true);
    setBookingsError(null);
    setSearched(true);
    try {
      const rows = await fetchBookingsByEmail(email);
      setBookings(rows);
    } catch (e) {
      setBookingsError(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setBookingsLoading(false);
    }
  }

  function openBookings() {
    setView('bookings');
    window.scrollTo({ top: 0 });
    if (lastBookingEmail && !searched) {
      loadBookings(lastBookingEmail);
    }
  }

  if (view === 'detail' && selected) {
    return (
      <RobotDetailPage
        robot={selected}
        submitting={submitting}
        submitError={submitError}
        onBack={goCatalog}
        onSubmit={submitBooking}
        onViewBookings={openBookings}
      />
    );
  }

  if (view === 'bookings') {
    return (
      <BookingsPage
        bookings={bookings}
        loading={bookingsLoading}
        searched={searched}
        error={bookingsError}
        onBack={goCatalog}
        onSearch={loadBookings}
        onBrowse={goCatalog}
      />
    );
  }

  return (
    <CatalogPage
      robots={robots}
      loading={loading}
      error={error}
      onOpenRobot={openRobot}
    />
  );
}
