import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import CatalogPage from '@/components/CatalogPage';
import OnboardingPage from '@/components/OnboardingPage';
import ProfilePage from '@/components/ProfilePage';
import PricingAdminPage from '@/components/PricingAdminPage';
import RobotDetailPage from '@/components/RobotDetailPage';
import RentedRobotGuidePage from '@/components/RentedRobotGuidePage';
import RentedRobotsPage from '@/components/RentedRobotsPage';
import BookingsPage from '@/components/BookingsPage';
import MobileNav, { type MobileTab } from '@/components/MobileNav';
import WelcomePage from '@/components/WelcomePage';
import { supabase } from '@/lib/supabase';
import {
  createBooking,
  fetchHubs,
  fetchIsAdmin,
  fetchMyBookings,
  fetchPricingAudit,
  fetchPricingSettings,
  fetchProviderProfile,
  fetchRobotPricing,
  fetchRobots,
} from '@/lib/api';
import { DEFAULT_SETTINGS, type Hub, type PricingSettings, type RobotPricing } from '@/lib/pricing';
import type { Booking, NewBooking, ProviderProfile, Robot } from '@/lib/types';

type View = 'catalog' | 'detail' | 'bookings' | 'profile' | 'rented' | 'rentedGuide' | 'pricingAdmin';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pricingByRobot, setPricingByRobot] = useState<Map<string, RobotPricing>>(new Map());
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [audit, setAudit] = useState<{ id: string; robot_id: string | null; scope: string; summary: string; created_at: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [view, setView] = useState<View>('catalog');
  const [selected, setSelected] = useState<Robot | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setAuthLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        setSession(nextSession);
        setAuthLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProviderProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    setProfileError(null);
    fetchProviderProfile()
      .then((profile) => {
        if (active) setProviderProfile(profile);
      })
      .catch(() => {
        if (active) setProfileError('Could not load your provider setup. Please refresh and try again.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    fetchRobots()
      .then((rows) => setRobots(rows))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadPricing = useCallback(async () => {
    try {
      const [settingsRows, pricingRows, hubRows, auditRows, adminFlag] = await Promise.all([
        fetchPricingSettings(),
        fetchRobotPricing(),
        fetchHubs(),
        fetchPricingAudit(),
        fetchIsAdmin(),
      ]);
      setPricingSettings(settingsRows);
      setPricingByRobot(new Map(pricingRows.map((p) => [p.robot_id, p])));
      setHubs(hubRows);
      setAudit(auditRows);
      setIsAdmin(adminFlag);
    } catch {
      // Pricing data is optional for browsing; admin screen surfaces its own errors.
    }
  }, []);

  useEffect(() => {
    if (session) loadPricing();
  }, [session, loadPricing]);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const rows = await fetchMyBookings();
      setBookings(rows);
    } catch (e) {
      setBookingsError(e instanceof Error ? e.message : 'Failed to load bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && view === 'rented') {
      loadBookings();
    }
  }, [session, view, loadBookings]);

  if (authLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div
          className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!session) {
    return <WelcomePage onAuthed={goCatalogAfterAuth} />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <div className="bg-white border border-ink-100 rounded-2xl shadow-sm p-8 max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-ink-950">Provider setup unavailable</h1>
          <p className="mt-2 text-sm text-ink-500">{profileError}</p>
        </div>
      </div>
    );
  }

  if (!providerProfile) {
    return (
      <OnboardingPage
        email={session.user.email ?? ''}
        onComplete={async () => {
          const profile = await fetchProviderProfile();
          setProviderProfile(profile);
        }}
      />
    );
  }

  function goCatalogAfterAuth() {
    setView('catalog');
    setSelected(null);
  }

  function openRobot(robot: Robot) {
    setSelected(robot);
    setSubmitError(null);
    setView('detail');
  }

  function goCatalog() {
    setView('catalog');
    setSelected(null);
  }

  function openRented() {
    setView('rented');
    window.scrollTo({ top: 0 });
  }

  function openRentedGuide(robot: Robot, booking: Booking) {
    setSelected(robot);
    setSelectedBooking(booking);
    setView('rentedGuide');
    window.scrollTo({ top: 0 });
  }

  function handleMobileNav(tab: MobileTab) {
    if (tab === 'profile') {
      setView('profile');
      window.scrollTo({ top: 0 });
      return;
    }
    if (tab === 'bookings') {
      setView('bookings');
      window.scrollTo({ top: 0 });
      return;
    }
    if (tab === 'rented') {
      openRented();
      return;
    }
    // 'home' and 'browse' live on the catalog screen
    goCatalog();
    if (tab === 'browse') {
      requestAnimationFrame(() => {
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  async function submitBooking(booking: NewBooking) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createBooking(booking);
      setBookings([]);
      setView('bookings');
      await loadBookings();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function openBookings() {
    setView('bookings');
    window.scrollTo({ top: 0 });
  }

  function openPricingAdmin() {
    setView('pricingAdmin');
    window.scrollTo({ top: 0 });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setBookings([]);
    setView('catalog');
    setSelected(null);
  }

  function activeMobileTab(): MobileTab {
    if (view === 'profile') return 'profile';
    if (view === 'bookings') return 'bookings';
    if (view === 'rented' || view === 'rentedGuide') return 'rented';
    return 'home';
  }

  const mobileNav =
    view !== 'detail' ? <MobileNav active={activeMobileTab()} onNavigate={handleMobileNav} /> : null;

  if (view === 'detail' && selected) {
    return (
      <RobotDetailPage
        robot={selected}
        pricing={pricingByRobot.get(selected.id) ?? null}
        settings={pricingSettings}
        submitting={submitting}
        submitError={submitError}
        onBack={goCatalog}
        onSubmit={submitBooking}
        onViewBookings={openBookings}
      />
    );
  }

  if (view === 'pricingAdmin') {
    return (
      <PricingAdminPage
        robots={robots}
        pricingByRobot={pricingByRobot}
        settings={pricingSettings}
        hubs={hubs}
        audit={audit}
        isAdmin={isAdmin}
        currentUserId={session.user.id}
        onBack={goCatalog}
        onDataChanged={loadPricing}
      />
    );
  }

  if (view === 'rentedGuide' && selected && selectedBooking) {
    return (
      <>
        <RentedRobotGuidePage robot={selected} booking={selectedBooking} onBack={openRented} />
        {mobileNav}
      </>
    );
  }

  if (view === 'rented') {
    return (
      <>
        <RentedRobotsPage
          bookings={bookings}
          loading={bookingsLoading}
          error={bookingsError}
          onOpenRobot={openRentedGuide}
          onRetry={loadBookings}
          onBrowse={goCatalog}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'bookings') {
    return (
      <>
        <BookingsPage
          bookings={bookings}
          loading={bookingsLoading}
          error={bookingsError}
          userEmail={session.user.email ?? ''}
          onBack={goCatalog}
          onBrowse={goCatalog}
          onRetry={loadBookings}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'profile') {
    return (
      <>
        <ProfilePage
          userEmail={session.user.email ?? ''}
          profile={providerProfile}
          isAdmin={isAdmin}
          onBrowse={goCatalog}
          onViewBookings={openBookings}
          onSignOut={handleSignOut}
          onOpenPricingAdmin={openPricingAdmin}
        />
        {mobileNav}
      </>
    );
  }

  return (
    <>
      <CatalogPage
        robots={robots}
        loading={loading}
        error={error}
        userEmail={session.user.email ?? ''}
        onOpenRobot={openRobot}
        onSignOut={handleSignOut}
      />
      {mobileNav}
    </>
  );
}
