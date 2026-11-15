import { ArrowLeft, Building2, Calendar, Check, Home, MapPin, ShieldCheck, Star, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { NewBooking, Robot, RobotCategory } from '@/lib/types';
import { daysBetween, formatMoney, PRICING_VERSION } from '@/lib/types';
import type { DurationType, PricingSettings, RobotPricing } from '@/lib/pricing';
import { durationForDays, quoteBookingTotal, quoteRobot } from '@/lib/pricing';

interface Props {
  robot: Robot;
  pricing: RobotPricing | null;
  settings: PricingSettings;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: (booking: NewBooking) => void;
  onViewBookings: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function datePlusDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

const durationLabels: Record<DurationType, { title: string; blurb: string }> = {
  daily: { title: 'Daily rental', blurb: '1–6 days. Highest flexibility for short jobs.' },
  weekly: { title: 'Weekly rental', blurb: '7–27 days. Save on week-long client runs.' },
  monthly: { title: 'Monthly rental', blurb: '28 days or longer. Best value for steady work.' },
};

export default function RobotDetailPage({ robot, pricing, settings, submitting, submitError, onBack, onSubmit, onViewBookings }: Props) {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState((() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  })());
  const [usageType, setUsageType] = useState<RobotCategory>(robot.category);
  const [damageProtection, setDamageProtection] = useState(false);
  const [minimumTermMonths, setMinimumTermMonths] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const days = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const duration = useMemo(() => durationForDays(days), [days]);

  // Fallback when pricing configuration has not been loaded: use catalog rates.
  const quote = useMemo(() => {
    if (pricing) return quoteRobot(pricing, settings);
    return null;
  }, [pricing, settings]);

  const totals = useMemo(() => {
    if (quote) {
      const t = quoteBookingTotal(quote, duration, days);
      const protectionFee = damageProtection ? Math.round(t.base * 0.09 * 100) / 100 : 0;
      const total = Math.round((t.base + t.tax + protectionFee) * 100) / 100;
      return { ...t, deliveryFee: 0, protectionFee, total, unitPrice: quote.quotes[duration].price, floorPrice: quote.quotes[duration].floorPrice };
    }
    // Legacy catalog-rate fallback so booking never breaks without pricing rows.
    const unitPrice = duration === 'daily' ? Number(robot.daily_rate) : duration === 'weekly' ? Number(robot.weekly_rate) : Number(robot.monthly_rate);
    const units = duration === 'daily' ? days : duration === 'weekly' ? Math.ceil(days / 7) : Math.ceil(days / 30);
    const base = Math.round(unitPrice * units * 100) / 100;
    return { duration, units, base, tax: 0, deposit: 0, total: base, effectiveDaily: days > 0 ? Math.round((base / days) * 100) / 100 : base, deliveryFee: 0, protectionFee: damageProtection ? Math.round(base * 0.09 * 100) / 100 : 0, unitPrice, floorPrice: 0 };
  }, [quote, duration, days, robot, damageProtection]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const datesValid = new Date(endDate) >= new Date(startDate);
  const formValid = name.trim().length > 1 && emailValid && datesValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!formValid || submitting) return;
    const snapshot = {
      duration_type: duration,
      unit_price: totals.unitPrice,
      units: totals.units,
      base_price: totals.base,
      tax_amount: totals.tax,
      deposit_amount: quote ? quote.deposit : 0,
      delivery_fee: totals.deliveryFee,
      damage_protection_fee: totals.protectionFee,
      total_price: totals.total,
      effective_daily_rate: totals.effectiveDaily,
      floor_price: totals.floorPrice,
      minimum_term_months: duration === 'monthly' ? minimumTermMonths : null,
      pricing_version: PRICING_VERSION,
      recorded_at: new Date().toISOString(),
    };
    onSubmit({
      robot_id: robot.id,
      renter_name: name.trim(),
      renter_email: email.trim(),
      renter_phone: phone.trim() || undefined,
      usage_type: usageType,
      plan_type: duration === 'monthly' ? 'lease' : 'rental',
      start_date: startDate,
      end_date: endDate,
      days,
      total_price: totals.total,
      notes: notes.trim() || undefined,
      pricing_snapshot: snapshot,
      duration_type: duration,
      minimum_term_months: duration === 'monthly' ? minimumTermMonths : null,
      deposit_amount: quote ? quote.deposit : 0,
      delivery_fee: totals.deliveryFee,
      damage_protection_fee: totals.protectionFee,
      tax_amount: totals.tax,
    });
  }

  const durationOrder: DurationType[] = ['daily', 'weekly', 'monthly'];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft size={18} /> Back to cleaning robots
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <div className="rounded-2xl overflow-hidden border border-ink-100 shadow-sm aspect-[4/3] bg-ink-100">
              <img src={robot.image_url} alt={robot.name} className="w-full h-full object-cover" />
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {robot.category === 'commercial' ? <Building2 size={14} /> : <Home size={14} />}
                  <span>{robot.category === 'commercial' ? 'Professional grade' : 'Home-ready'}</span>
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {robot.location}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-ink-900">
                  <Star size={14} className="fill-amber-400 text-amber-400" /> {robot.rating.toFixed(1)}
                  <span className="text-ink-400 font-normal">({robot.reviews_count})</span>
                </span>
              </div>
              <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">{robot.name}</h1>
              <p className="mt-2 text-lg text-brand-700 font-medium">{robot.tagline}</p>
              <p className="mt-4 text-ink-600 leading-relaxed">{robot.description}</p>
            </div>

            <div className="mt-8">
              <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                <Wrench size={18} className="text-brand-700" /> Specifications
              </h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(robot.specs).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-xl border border-ink-100 px-4 py-3">
                    <dt className="text-xs text-ink-500">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-8">
              <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                <ShieldCheck size={18} className="text-brand-700" /> What is included
              </h2>
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {robot.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700 bg-white border border-ink-100 rounded-xl px-4 py-3">
                    <Check size={16} className="text-brand-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 self-start w-full">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">
              <div>
                <span className="text-xs font-semibold text-ink-600 mb-2 block">Choose your rental duration</span>
                <div className="space-y-2.5">
                  {durationOrder.map((d) => {
                    const price = quote ? quote.quotes[d].price : d === 'daily' ? Number(robot.daily_rate) : d === 'weekly' ? Number(robot.weekly_rate) : Number(robot.monthly_rate);
                    const effDaily = price / (d === 'daily' ? 1 : d === 'weekly' ? 7 : 30);
                    const selected = duration === d;
                    const isMonthly = d === 'monthly';
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const minDays = d === 'daily' ? 1 : d === 'weekly' ? 7 : 28;
                          const minEnd = datePlusDays(startDate, minDays - 1);
                          if (new Date(endDate) < new Date(minEnd)) setEndDate(minEnd);
                          if (d === 'monthly') setMinimumTermMonths((m) => (m === 1 ? 1 : m));
                        }}
                        className={`w-full text-left rounded-xl border p-4 transition-all relative ${
                          selected
                            ? isMonthly
                              ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                              : 'border-ink-900 bg-ink-50 ring-1 ring-ink-900'
                            : 'border-ink-200 bg-white hover:border-ink-300'
                        }`}
                      >
                        {isMonthly && (
                          <span className="absolute -top-2.5 right-3 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                            Best for Professional Cleaners
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-ink-900">{durationLabels[d].title}</p>
                            <p className="text-xs text-ink-500 mt-0.5">{durationLabels[d].blurb}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display text-xl font-bold text-ink-900">
                              {formatMoney(price)}
                              <span className="text-xs font-medium text-ink-500">/{d === 'daily' ? 'day' : d === 'weekly' ? 'week' : 'month'}</span>
                            </p>
                            <p className="text-[11px] text-ink-500">≈ {formatMoney(Math.round(effDaily * 100) / 100)}/day effective</p>
                          </div>
                        </div>
                        {isMonthly && (
                          <div className="mt-3 pt-3 border-t border-brand-200/60 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-ink-700">Minimum term:</span>
                            {[1, 3, 6, 12].map((m) => (
                              <span
                                key={m}
                                className={`text-xs rounded-full px-2 py-0.5 font-medium border ${
                                  minimumTermMonths === m
                                    ? 'bg-brand-600 text-white border-brand-600'
                                    : 'bg-white text-ink-600 border-ink-200'
                                }`}
                              >
                                {m} mo{m > 1 ? 's' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    min={todayStr()}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">End date</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </label>
              </div>
              {touched && !datesValid && (
                <p className="text-xs text-red-600 -mt-2">End date must be on or after the start date.</p>
              )}

              <div>
                <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Where will you use it?</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['commercial', 'residential'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setUsageType(t)}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        usageType === t
                          ? 'bg-ink-900 text-white border-ink-900'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                      }`}
                    >
                      {t === 'commercial' ? <Building2 size={15} /> : <Home size={15} />}
                      <span>{t === 'commercial' ? 'Client homes' : 'Personal home'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3 cursor-pointer hover:border-ink-300 transition-colors">
                  <span>
                    <span className="text-sm font-semibold text-ink-900 block">Damage protection</span>
                    <span className="text-xs text-ink-500">Covers accidental damage, 9% of the base price.</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={damageProtection} onChange={(e) => setDamageProtection(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Full name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Rivera"
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  {touched && name.trim().length <= 1 && (
                    <span className="text-xs text-red-600 mt-1 block">Please enter your name.</span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  {touched && !emailValid && (
                    <span className="text-xs text-red-600 mt-1 block">Please enter a valid email — your confirmation and booking lookup use it.</span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Phone <span className="font-normal text-ink-400">(optional)</span></span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Notes <span className="font-normal text-ink-400">(optional)</span></span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Floor types, gate codes, anything we should know before pickup..."
                    className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  />
                </label>
              </div>

              <div className="rounded-xl bg-ink-50 border border-ink-100 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-ink-600">
                  <span className="inline-flex items-center gap-2"><Calendar size={15} /> Service period</span>
                  <span className="font-semibold text-ink-900">{days} day{days > 1 ? 's' : ''} · {durationLabels[duration].title}</span>
                </div>
                <div className="flex items-center justify-between text-ink-600">
                  <span>{durationLabels[duration].title} ({totals.units} × {formatMoney(totals.unitPrice)})</span>
                  <span className="font-semibold text-ink-900">{formatMoney(totals.base)}</span>
                </div>
                {totals.tax > 0 && (
                  <div className="flex items-center justify-between text-ink-600">
                    <span>Tax</span>
                    <span className="font-semibold text-ink-900">{formatMoney(totals.tax)}</span>
                  </div>
                )}
                {totals.protectionFee > 0 && (
                  <div className="flex items-center justify-between text-ink-600">
                    <span>Damage protection</span>
                    <span className="font-semibold text-ink-900">{formatMoney(totals.protectionFee)}</span>
                  </div>
                )}
                {quote && quote.deposit > 0 && (
                  <div className="flex items-center justify-between text-ink-600">
                    <span>Refundable deposit <span className="text-xs">(returned after inspection)</span></span>
                    <span className="font-semibold text-ink-900">{formatMoney(quote.deposit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-ink-200 text-base">
                  <span className="font-semibold text-ink-900">Total due today</span>
                  <span className="font-display font-bold text-xl text-ink-900">{formatMoney(totals.total)}</span>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
                  Booking failed: {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3.5 rounded-xl transition-colors"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm booking'
                )}
              </button>
              <p className="text-xs text-ink-400 text-center">
                Free cancellation up to 48 hours before your pickup. Prices include pickup and return conditions — no hidden fees at checkout.
              </p>
            </form>

            <button
              onClick={onViewBookings}
              className="mt-4 w-full text-sm font-semibold text-ink-600 hover:text-ink-900 py-2 transition-colors"
            >
              View my bookings →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
