import { ArrowRight, BarChart3, Bot, CalendarCheck, LogOut, Mail, MapPin, Phone, Sparkles, UserRound } from 'lucide-react';
import type { ProviderProfile } from '@/lib/types';

interface Props {
  userEmail: string;
  profile: ProviderProfile | null;
  onBrowse: () => void;
  onViewBookings: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
  onOpenPricingAdmin: () => void;
}

const providerTypeLabels: Record<string, string> = {
  individual: 'Individual cleaner',
  sole_proprietor: 'Sole proprietor',
  cleaning_company: 'Cleaning company',
  company_employee: 'Company employee',
};

const experienceLabels: Record<string, string> = {
  none: 'New to automated equipment',
  some: 'Some hands-on experience',
  experienced: 'Experienced operator',
};

export default function ProfilePage({ userEmail, profile, isAdmin, onBrowse, onViewBookings, onSignOut, onOpenPricingAdmin }: Props) {
  const displayName = profile?.display_name || userEmail.split('@')[0];

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2.5">
          <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
          <span className="font-display font-bold text-xl tracking-tight">Rent-A-Robot</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12">
        <section className="bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <span className="w-20 h-20 rounded-3xl bg-brand-100 border border-brand-200 flex items-center justify-center shrink-0">
              <UserRound size={36} className="text-brand-700" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink-950 truncate">{displayName}</h1>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-500 min-w-0">
                <Mail size={15} className="shrink-0" />
                <span className="truncate">{userEmail}</span>
              </p>
              {profile && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
                  <Sparkles size={13} />
                  {providerTypeLabels[profile.provider_type] ?? 'Provider'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <button
              onClick={onViewBookings}
              className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              <CalendarCheck size={17} /> View my bookings
            </button>
            <button
              onClick={onBrowse}
              className="inline-flex items-center justify-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              Browse cleaning robots <ArrowRight size={17} />
            </button>
          </div>
        </section>

        {profile ? (
          <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">Provider profile</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <Detail label="Mobile phone" value={profile.mobile_phone} icon={<Phone size={15} />} />
              <Detail label="Preferred language" value={profile.preferred_language} />
              <Detail
                label="Services offered"
                value={profile.service_types.length > 0 ? profile.service_types.join(', ') : 'Not set yet'}
              />
              <Detail label="Team size" value={profile.team_size <= 1 ? 'Just me' : `${profile.team_size} cleaners`} />
              <Detail
                label="Service area"
                value={profile.service_area_zips.length > 0 ? profile.service_area_zips.join(', ') : profile.home_zip}
                icon={<MapPin size={15} />}
              />
              <Detail
                label="Equipment experience"
                value={experienceLabels[profile.automation_experience] ?? profile.automation_experience}
                icon={<Bot size={15} />}
              />
            </dl>
          </section>
        ) : (
          <section className="mt-6 bg-brand-50 border border-brand-100 rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-brand-950">Finish your provider setup</h2>
            <p className="mt-2 text-sm text-brand-900/80 leading-relaxed">
              Your provider profile has not been completed yet, so your bookings and robot access are limited. Contact support if you believe this is a mistake.
            </p>
          </section>
        )}

        {isAdmin && (
          <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">Operations</h2>
            <button
              onClick={onOpenPricingAdmin}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-ink-200 text-ink-800 hover:bg-ink-50 font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              <BarChart3 size={17} /> Pricing Management
            </button>
          </section>
        )}

        <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">Account</h2>
          <button
            onClick={onSignOut}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            <LogOut size={17} /> Sign out
          </button>
        </section>
      </main>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 sm:items-center">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="font-semibold text-ink-900 text-right flex items-center gap-1.5 min-w-0">
        {icon && <span className="text-ink-400 shrink-0">{icon}</span>}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
