import { ArrowRight, BarChart3, Bot, CalendarCheck, Check, LogOut, Mail, MapPin, Pencil, Phone, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import type { OnboardingInput, ProviderProfile } from '@/lib/types';
import { completeProviderOnboarding } from '@/lib/api';

interface Props {
  userEmail: string;
  profile: ProviderProfile | null;
  onBrowse: () => void;
  onViewBookings: () => void;
  onSignOut: () => void;
  onAccountDeleted: () => void;
  onProfileSaved: (profile: ProviderProfile) => void;
  isAdmin: boolean;
  onOpenPricingAdmin: () => void;
}

const providerTypeLabels: Record<string, string> = {
  individual: 'Individual Cleaner',
  sole_proprietor: 'Sole Proprietor',
  cleaning_company: 'Cleaning Company',
  company_employee: 'Company Employee',
  homeowner: 'Homeowner',
  renter: 'Renter',
};

const experienceLabels: Record<string, string> = {
  none: 'New to automated equipment',
  some: 'Some hands-on experience',
  experienced: 'Experienced operator',
};

const languageOptions = ['English', 'Spanish', 'French', 'Other'];
const providerTypeOptions = Object.entries(providerTypeLabels) as [string, string][];

export default function ProfilePage({
  userEmail,
  profile,
  onBrowse,
  onViewBookings,
  onSignOut,
  onAccountDeleted,
  onProfileSaved,
  isAdmin,
  onOpenPricingAdmin,
}: Props) {
  const displayName = profile?.display_name || userEmail.split('@')[0];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<OnboardingInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEdit() {
    if (!profile) return;
    setDraft({
      full_legal_name: profile.full_legal_name,
      display_name: profile.display_name,
      mobile_phone: profile.mobile_phone,
      preferred_contact_method: profile.preferred_contact_method,
      preferred_language: profile.preferred_language,
      provider_type: profile.provider_type,
      legal_business_name: profile.legal_business_name ?? undefined,
      public_business_name: profile.public_business_name ?? undefined,
      business_structure: profile.business_structure ?? undefined,
      business_address: profile.business_address ?? undefined,
      business_website: profile.business_website ?? undefined,
      ein_status: 'not_provided',
      owner_representative_name: profile.owner_representative_name ?? undefined,
      team_size: profile.team_size,
      service_types: profile.service_types,
      other_specialties: profile.other_specialties ?? undefined,
      home_zip: profile.home_zip,
      service_area_zips: profile.service_area_zips,
      rates_include_platform_fee: profile.rates_include_platform_fee,
      owned_equipment: profile.owned_equipment,
      equipment_models: profile.equipment_models ?? undefined,
      automation_experience: profile.automation_experience ?? '',
      training_completed: profile.training_completed ?? undefined,
    });
    setSaveError(null);
    setEditing(true);
  }

  function updateDraft<K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveEdit() {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await completeProviderOnboarding({
        ...draft,
        full_legal_name: draft.full_legal_name.trim(),
        display_name: draft.display_name.trim() || draft.full_legal_name.trim(),
        mobile_phone: draft.mobile_phone.trim(),
        home_zip: draft.home_zip.trim(),
        service_area_zips: draft.service_area_zips.map((area) => area.trim()).filter(Boolean),
      });
      setEditing(false);
      onProfileSaved(profile!);
    } catch {
      setSaveError('Could not save your changes. Please check the values and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      onAccountDeleted();
    } catch {
      setDeleteError('Could not delete your account. Please try again or contact support.');
      setDeleting(false);
    }
  }

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
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex-1 font-display text-lg font-bold tracking-tight text-ink-950 text-center sm:text-left">Customer Profile</h2>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 border border-ink-200 text-ink-800 hover:bg-ink-50 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors shrink-0"
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
            </div>

            {editing && draft ? (
              <div className="mt-5 space-y-3">
                <EditField label="Full legal name" value={draft.full_legal_name} onChange={(v) => updateDraft('full_legal_name', v)} />
                <EditField label="Mobile phone" value={draft.mobile_phone} onChange={(v) => updateDraft('mobile_phone', v)} type="tel" />
                <EditDropdown
                  label="Customer type"
                  value={draft.provider_type}
                  onChange={(v) => updateDraft('provider_type', v as ProviderProfile['provider_type'])}
                  options={providerTypeOptions}
                />
                <EditDropdown
                  label="Preferred language"
                  value={draft.preferred_language}
                  onChange={(v) => updateDraft('preferred_language', v)}
                  options={languageOptions.map((l) => [l, l])}
                />
                <EditField label="Home or business ZIP code" value={draft.home_zip} onChange={(v) => updateDraft('home_zip', v)} />
                <EditField
                  label="Service areas (comma separated)"
                  value={draft.service_area_zips.join(', ')}
                  onChange={(v) => updateDraft('service_area_zips', v.split(',').map((a) => a.trim()).filter(Boolean))}
                />
                <EditDropdown
                  label="Equipment experience"
                  value={draft.automation_experience}
                  onChange={(v) => updateDraft('automation_experience', v)}
                  options={Object.entries(experienceLabels)}
                />
                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{saveError}</div>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
                  >
                    <Check size={17} /> {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveError(null); }}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 border border-ink-200 text-ink-700 hover:bg-ink-50 font-semibold px-5 py-3 rounded-xl transition-colors"
                  >
                    <X size={17} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="mt-5 space-y-4 text-sm">
                <Detail label="Full legal name" value={profile.full_legal_name} />
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
                  value={experienceLabels[profile.automation_experience] ?? profile.automation_experience ?? 'Not set yet'}
                  icon={<Bot size={15} />}
                />
              </dl>
            )}
          </section>
        ) : (
          <section className="mt-6 bg-brand-50 border border-brand-100 rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-brand-950 text-center">Finish Your Provider Setup</h2>
            <p className="mt-2 text-sm text-brand-900/80 leading-relaxed">
              Your provider profile has not been completed yet, so your bookings and robot access are limited. Contact support if you believe this is a mistake.
            </p>
          </section>
        )}

        {isAdmin && (
          <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink-950 text-center">Operations</h2>
            <button
              onClick={onOpenPricingAdmin}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-ink-200 text-ink-800 hover:bg-ink-50 font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              <BarChart3 size={17} /> Pricing Management
            </button>
          </section>
        )}

        <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink-950 text-center">Account</h2>
          <button
            onClick={onSignOut}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-ink-200 text-ink-800 hover:bg-ink-50 font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            <LogOut size={17} /> Sign out
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => { setConfirmDelete(true); setDeleteError(null); }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              <Trash2 size={17} /> Delete Account
            </button>
          ) : (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">Delete your account permanently?</p>
              <p className="mt-1 text-sm text-red-800/90 leading-relaxed">
                This removes your profile, bookings and sign-in access. This cannot be undone.
              </p>
              {deleteError && <p className="mt-2 text-sm font-semibold text-red-900">{deleteError}</p>}
              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
                >
                  <Trash2 size={17} /> {deleting ? 'Deleting...' : 'Yes, delete everything'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 border border-red-200 bg-white text-red-700 hover:bg-red-50 font-semibold px-5 py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </label>
  );
}

function EditDropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
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
