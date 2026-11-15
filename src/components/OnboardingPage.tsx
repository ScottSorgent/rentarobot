import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { OnboardingInput, ProviderType } from '@/lib/types';
import { completeProviderOnboarding } from '@/lib/api';

interface Props {
  email: string;
  onComplete: () => Promise<void>;
}

const steps = [
  { title: 'Account', icon: UserRound },
  { title: 'Your Work', icon: Building2 },
  { title: 'Area, Gear & Agreements', icon: ShieldCheck },
] as const;

const initialForm: OnboardingInput = {
  full_legal_name: '',
  display_name: '',
  mobile_phone: '',
  preferred_contact_method: 'email',
  preferred_language: 'English',
  provider_type: 'individual',
  ein_status: 'not_provided',
  team_size: 1,
  service_types: [],
  home_zip: '',
  service_area_zips: [],
  rates_include_platform_fee: false,
  owned_equipment: false,
  automation_experience: '',
};

const providerTypeOptions: [ProviderType, string][] = [
  ['individual', 'Individual cleaner (just me)'],
  ['sole_proprietor', 'Sole proprietor / self-employed'],
  ['cleaning_company', 'Cleaning company'],
  ['company_employee', 'Employee joining an existing company'],
  ['homeowner', 'Homeowner'],
  ['renter', 'Renter'],
];

const businessStructureOptions = [
  'Sole proprietorship',
  'LLC',
  'Corporation',
  'Partnership',
  'Other / not sure yet',
];

const serviceOptions = [
  'Residential cleaning',
  'Storefront cleaning',
  'Office or commercial cleaning',
];

const teamSizeOptions = ['1 (just me)', '2-3', '4-6', '7-10', 'More than 10'];

const languageOptions = ['English', 'Spanish', 'French', 'Other'];

export default function OnboardingPage({ email, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingInput>(initialForm);
  const [providerAgreement, setProviderAgreement] = useState(false);
  const [platformTerms, setPlatformTerms] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isBusiness = ['sole_proprietor', 'cleaning_company', 'company_employee'].includes(form.provider_type);

  function update<K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateCurrentStep(): string | null {
    if (step === 0) {
      if (form.full_legal_name.trim().length < 2) return 'Please enter your full legal name.';
      if (form.mobile_phone.trim().length < 7) return 'Please enter a valid mobile phone number.';
    }
    if (step === 1) {
      if (form.service_types.length === 0) return 'Select at least one service type.';
      if (isBusiness && !form.legal_business_name?.trim()) return 'Please enter the legal business name.';
      if (isBusiness && !form.owner_representative_name?.trim()) return 'Please enter the owner or authorized representative.';
    }
    if (step === 2) {
      if (form.home_zip.trim().length < 3) return 'Please enter your home or business ZIP code.';
      if (form.service_area_zips.length === 0) return 'Add at least one city or ZIP code you serve.';
      if (!form.automation_experience) return 'Please tell us about your automated-equipment experience.';
      if (!providerAgreement || !platformTerms || !privacyPolicy) return 'Accept all three agreements to finish setup.';
    }
    return null;
  }

  function nextStep() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function finish() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeProviderOnboarding({
        ...form,
        full_legal_name: form.full_legal_name.trim(),
        display_name: form.full_legal_name.trim(),
        mobile_phone: form.mobile_phone.trim(),
        legal_business_name: form.legal_business_name?.trim(),
        owner_representative_name: form.owner_representative_name?.trim(),
        home_zip: form.home_zip.trim(),
        service_area_zips: form.service_area_zips.map((area) => area.trim()).filter(Boolean),
      });
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not finish setup. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Let’s get you ready</p>
          <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-ink-950">Build your provider profile.</h1>
          <p className="mt-3 text-sm text-ink-500 leading-relaxed">Three quick screens — most questions are simple dropdown picks.</p>
        </div>

        <nav className="mt-6 flex items-center" aria-label="Onboarding progress">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = index === step;
            const complete = index < step;
            return (
              <div key={item.title} className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                <button
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  disabled={index > step}
                  className={`flex items-center gap-2.5 text-left transition-colors ${
                    active ? 'text-ink-950' : complete ? 'text-brand-800 hover:text-brand-900' : 'text-ink-400'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                      active
                        ? 'bg-ink-950 text-white border-ink-950'
                        : complete
                          ? 'bg-brand-100 text-brand-800 border-brand-200'
                          : 'bg-white text-ink-400 border-ink-200'
                    }`}
                  >
                    {complete ? <Check size={15} /> : <Icon size={15} />}
                  </span>
                  <span className="hidden md:block">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Step {index + 1}</span>
                    <span className="block text-xs font-semibold whitespace-nowrap">{item.title}</span>
                  </span>
                  <span className="md:hidden text-xs font-semibold whitespace-nowrap">Step {index + 1}</span>
                </button>
                {index < steps.length - 1 && (
                  <span className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${complete ? 'bg-brand-400' : 'bg-ink-200'}`} />
                )}
              </div>
            );
          })}
        </nav>

        <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-5 sm:p-6">
            {step === 0 && (
              <StepShell
                eyebrow="Step 1 · Account"
                title="Tell us who you are"
                description="Use the name we should use for agreements and the name clients should see."
                icon={<UserRound size={20} />}
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Full legal name" value={form.full_legal_name} onChange={(value) => update('full_legal_name', value)} placeholder="Jordan Rivera" required />
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-ink-700">Email address</span>
                    <span className="mt-1.5 flex items-center gap-2 bg-ink-50 border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-600"><Mail size={16} className="text-ink-400" />{email}</span>
                    <span className="mt-1.5 block text-xs text-ink-500">Your sign-in email is used for confirmations and account notices.</span>
                  </label>
                  <Field label="Mobile phone number" value={form.mobile_phone} onChange={(value) => update('mobile_phone', value)} placeholder="(555) 000-0000" type="tel" required />
                  <DropdownField label="Preferred language" value={form.preferred_language} onChange={(value) => update('preferred_language', value)} options={languageOptions.map((language) => [language, language])} icon={<Languages size={15} />} />
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell
                eyebrow="Step 2 · Your Work"
                title="What kind of work do you do?"
                description="Pick your setup and services — everything here is a dropdown except business names."
                icon={<Sparkles size={20} />}
              >
                <div className="space-y-3">
                  <DropdownField
                    label="Customer type"
                    value={form.provider_type}
                    onChange={(value) => update('provider_type', value as ProviderType)}
                    options={providerTypeOptions}
                    icon={<Building2 size={15} />}
                  />
                  <MultiSelectField
                    label="Service types"
                    options={serviceOptions}
                    selected={form.service_types}
                    onChange={(next) => update('service_types', next)}
                    placeholder="Select the services you offer"
                  />
                  <DropdownField label="Team size" value={teamSizeLabel(form.team_size)} onChange={(value) => update('team_size', teamSizeFromLabel(value))} options={teamSizeOptions.map((option) => [option, option])} />
                  {isBusiness && (
                    <div className="grid sm:grid-cols-2 gap-3 rounded-2xl border border-ink-200 p-3.5">
                      <Field label="Legal business name" value={form.legal_business_name ?? ''} onChange={(value) => update('legal_business_name', value)} placeholder="Rivera Home Services LLC" required />
                      <Field label="Owner or authorized representative" value={form.owner_representative_name ?? ''} onChange={(value) => update('owner_representative_name', value)} placeholder="Jordan Rivera" required />
                      <div className="sm:col-span-2">
                        <DropdownField
                          label="Business structure"
                          value={form.business_structure ?? businessStructureOptions[0]}
                          onChange={(value) => update('business_structure', value)}
                          options={businessStructureOptions.map((option) => [option, option])}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                eyebrow="Step 3 · Area, Gear & Agreements"
                title="Where you work and how you're set up"
                description="Finish with your service area, equipment experience and the required agreements."
                icon={<ShieldCheck size={20} />}
              >
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Home or business ZIP code" value={form.home_zip} onChange={(value) => update('home_zip', value)} placeholder="94107" required />
                    <Field label="Cities or ZIP codes served" value={form.service_area_zips.join(', ')} onChange={(value) => update('service_area_zips', value.split(',').map((area) => area.trim()).filter(Boolean))} placeholder="94107, 94110, San Francisco" required hint="Separate multiple areas with commas." />
                  </div>
                  <DropdownField
                    label="Experience operating robotic cleaning equipment"
                    value={form.automation_experience}
                    onChange={(value) => update('automation_experience', value)}
                    options={[['none', 'New to automated equipment'], ['some', 'Some hands-on experience'], ['experienced', 'Experienced operator']]}
                  />
                  <div className="space-y-3 pt-2">
                    <Agreement checked={providerAgreement} onChange={setProviderAgreement} title="Provider agreement" text="I agree to provide accurate business and service information and follow the provider requirements." />
                    <Agreement checked={platformTerms} onChange={setPlatformTerms} title="Platform terms" text="I accept the terms for using Rent-A-Robot, including rentals, leases, support and account responsibilities." />
                    <Agreement checked={privacyPolicy} onChange={setPrivacyPolicy} title="Privacy policy" text="I understand how my profile and service information are used to operate the platform." />
                  </div>
                  <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4 text-sm text-brand-950">
                    <p className="font-semibold">Payment setup stays secure.</p>
                    <p className="mt-1 leading-relaxed">We never collect an SSN, EIN, bank account number or card details here. Payment and identity verification are handled by the payment provider.</p>
                  </div>
                </div>
              </StepShell>
            )}

            {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>}

            <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-between gap-3">
              {step > 0 ? (
                <button type="button" onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-ink-600 hover:text-ink-950 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={17} /> Back
                </button>
              ) : (
                <span className="text-sm font-medium text-ink-400">Step 1 of {steps.length}</span>
              )}
              {step < steps.length - 1 ? (
                <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
                  Continue <ChevronRight size={17} />
                </button>
              ) : (
                <button type="button" onClick={finish} disabled={saving} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-xl transition-colors">
                  {saving ? 'Saving profile...' : 'Finish provider setup'} <ArrowRight size={17} />
                </button>
              )}
            </div>
        </section>
      </main>
    </div>
  );
}

function teamSizeLabel(size: number): string {
  if (size <= 1) return teamSizeOptions[0];
  if (size <= 3) return teamSizeOptions[1];
  if (size <= 6) return teamSizeOptions[2];
  if (size <= 10) return teamSizeOptions[3];
  return teamSizeOptions[4];
}

function teamSizeFromLabel(label: string): number {
  switch (label) {
    case '1 (just me)':
      return 1;
    case '2-3':
      return 3;
    case '4-6':
      return 6;
    case '7-10':
      return 10;
    default:
      return 11;
  }
}

function StepShell({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 flex items-center justify-center shrink-0">{icon}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold tracking-tight text-ink-950">{title}</h2>
          <p className="mt-2 text-sm text-ink-500 leading-relaxed max-w-2xl">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}{required && ' *'}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
      {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function selectClass(icon?: React.ReactNode): string {
  return `w-full appearance-none border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${icon ? 'pl-10' : ''}`;
}

function DropdownField({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <span className="relative mt-1.5 block">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 z-10">{icon}</span>}
        <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass(icon)}>
          {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      </span>
    </label>
  );
}

function MultiSelectField({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  const summary = selected.length === 0 ? placeholder : selected.join(', ');

  return (
    <div className="relative" ref={ref}>
      <span className="text-xs font-semibold text-ink-700 block">Services *</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`mt-1.5 w-full flex items-center justify-between gap-3 border rounded-xl px-3.5 py-3 text-sm text-left transition-colors ${open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-ink-200 hover:border-ink-400'}`}
      >
        <span className={selected.length === 0 ? 'text-ink-400' : 'text-ink-900'}>{summary}</span>
        <ChevronDown size={16} className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-ink-200 rounded-xl shadow-lg p-2 space-y-1">
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <button key={option} type="button" onClick={() => toggle(option)} className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-900 hover:bg-ink-50 text-left">
                {option}
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'}`}>{checked && <Check size={14} />}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Agreement({ checked, onChange, title, text }: { checked: boolean; onChange: (checked: boolean) => void; title: string; text: string }) {
  return (
    <label className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${checked ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:border-ink-400'}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
      <span>
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="mt-1 block text-xs text-ink-500 leading-relaxed">{text}</span>
      </span>
    </label>
  );
}
