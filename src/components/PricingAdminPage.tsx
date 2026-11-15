import { AlertTriangle, BarChart3, Building2, History, Lock, Save, ShieldCheck, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Robot } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import type { Hub, PricingSettings, RobotPricing, RobotQuote } from '@/lib/pricing';
import { quoteRobot, round2, utilizationTable, UTILIZATION_LEVELS } from '@/lib/pricing';
import { addAdminByEmail, applyCatalogRates, fetchAdminList, removeAdmin, saveRobotPricing, savePlatformSettings } from '@/lib/api';

interface Props {
  robots: Robot[];
  pricingByRobot: Map<string, RobotPricing>;
  settings: PricingSettings;
  hubs: Hub[];
  audit: { id: string; robot_id: string | null; scope: string; summary: string; created_at: string }[];
  isAdmin: boolean;
  currentUserId: string;
  onBack: () => void;
  onDataChanged: () => void;
}

type MoneyField = {
  key: keyof RobotPricing;
  label: string;
  hint?: string;
};

const monthlyFields: MoneyField[] = [
  { key: 'monthly_maintenance', label: 'Maintenance & consumables reserve ($/mo)' },
  { key: 'monthly_hosting', label: 'Hosting allocation ($/mo)' },
  { key: 'monthly_insurance', label: 'Insurance allocation ($/mo, optional)' },
  { key: 'monthly_software', label: 'Software & connectivity ($/mo)' },
  { key: 'monthly_storage', label: 'Hub storage ($/mo, optional fallback)' },
  { key: 'handoff_incentive', label: 'Handoff incentive ($ per handoff)' },
];

const acquisitionFields: MoneyField[] = [
  { key: 'wholesale_cost', label: 'Used robot purchase ($)' },
  { key: 'battery_cost', label: 'New battery ($)' },
  { key: 'refurbishment_cost', label: 'Other refurbishment ($)' },
  { key: 'customer_acquisition_cost', label: 'Customer acquisition cost ($ one-time)' },
];

const bookingFields: MoneyField[] = [
  { key: 'checkout_handling', label: 'Checkout handling ($ per rental)' },
  { key: 'return_handling', label: 'Return handling ($ per rental, optional fallback)' },
  { key: 'processing_fixed', label: 'Payment processing fixed fee ($)' },
];

export default function PricingAdminPage({ robots, pricingByRobot, settings, hubs, audit, isAdmin, currentUserId, onBack, onDataChanged }: Props) {
  const [utilizationLevel, setUtilizationLevel] = useState<0.6 | 0.7 | 0.8 | 0.9 | 1.0>(0.8);
  const [editingRobotId, setEditingRobotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RobotPricing | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<PricingSettings>(settings);
  const [adminRows, setAdminRows] = useState<{ user_id: string; email: string | null; created_at: string }[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => setSettingsDraft(settings), [settings]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminList()
      .then((rows) => setAdminRows(rows))
      .catch(() => setAdminRows([]));
  }, [isAdmin]);

  async function handleAddAdmin() {
    setAdminError(null);
    const email = newAdminEmail.trim();
    if (!email) return;
    setSaving(true);
    try {
      await addAdminByEmail(email);
      setNewAdminEmail('');
      setAdminRows(await fetchAdminList());
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : 'Could not designate that administrator.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (userId === currentUserId) {
      setAdminError('You cannot remove your own administrator access.');
      return;
    }
    setAdminError(null);
    setSaving(true);
    try {
      await removeAdmin(userId);
      setAdminRows(await fetchAdminList());
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : 'Could not remove that administrator.');
    } finally {
      setSaving(false);
    }
  }

  const quotes = useMemo(() => {
    const map = new Map<string, RobotQuote>();
    for (const robot of robots) {
      const p = pricingByRobot.get(robot.id);
      if (p) map.set(robot.id, quoteRobot(p, settingsDraft, utilizationLevel));
    }
    return map;
  }, [robots, pricingByRobot, settingsDraft, utilizationLevel]);

  const fleet = useMemo(() => {
    let revenue = 0;
    let fixedCost = 0;
    let profit = 0;
    let missing = 0;
    for (const robot of robots) {
      const q = quotes.get(robot.id);
      if (!q) continue;
      revenue += q.monthlyRevenue;
      fixedCost += q.breakdown.totalFixedMonthly;
      profit += q.contributionProfit;
      if (q.missingCosts.length > 0) missing += 1;
    }
    return { revenue: round2(revenue), fixedCost: round2(fixedCost), profit: round2(profit), margin: revenue > 0 ? round2(profit / revenue) : 0, missing };
  }, [robots, quotes]);

  const hubStats = useMemo(() => {
    const byHub = new Map<string, { name: string; robots: number; revenue: number; profit: number; capacity: number }>();
    for (const hub of hubs) byHub.set(hub.id, { name: hub.name, robots: 0, revenue: 0, profit: 0, capacity: hub.robot_capacity });
    for (const robot of robots) {
      const p = pricingByRobot.get(robot.id);
      const q = quotes.get(robot.id);
      if (!p || !q) continue;
      const key = p.hub_id ?? 'unassigned';
      if (!byHub.has(key)) byHub.set(key, { name: 'Unassigned', robots: 0, revenue: 0, profit: 0, capacity: 10 });
      const entry = byHub.get(key)!;
      entry.robots += 1;
      entry.revenue = round2(entry.revenue + q.monthlyRevenue);
      entry.profit = round2(entry.profit + q.contributionProfit);
    }
    return Array.from(byHub.entries());
  }, [hubs, robots, pricingByRobot, quotes]);

  function startEdit(robotId: string) {
    const p = pricingByRobot.get(robotId);
    if (!p) return;
    setEditingRobotId(robotId);
    setDraft({ ...p });
    setSaveError(null);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const summary = `Updated cost configuration for ${draft.model_name || draft.robot_id}: acquisition ${(draft.wholesale_cost + draft.battery_cost + draft.refurbishment_cost).toFixed(2)}, maintenance ${draft.monthly_maintenance}/mo, CAC ${draft.customer_acquisition_cost} over ${draft.expected_bookings_per_customer} bookings.`;
      await saveRobotPricing(draft.robot_id, draft, summary);
      setEditingRobotId(null);
      setDraft(null);
      onDataChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the pricing changes.');
    } finally {
      setSaving(false);
    }
  }

  async function applyToCatalog(robotId: string) {
    const q = quotes.get(robotId);
    if (!q) return;
    setSaving(true);
    setSaveError(null);
    try {
      const robot = robots.find((r) => r.id === robotId);
      const summary = `Applied recommended prices to ${robot?.name ?? robotId}: daily ${q.quotes.daily.price}, weekly ${q.quotes.weekly.price}, monthly ${q.quotes.monthly.price}.`;
      await applyCatalogRates(robotId, {
        daily_rate: q.quotes.daily.price,
        weekly_rate: q.quotes.weekly.price,
        monthly_rate: q.quotes.monthly.price,
      }, summary);
      onDataChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not update catalog rates.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaveError(null);
    try {
      const summary = `Updated platform pricing defaults: target margin ${Math.round(settingsDraft.target_margin * 100)}%, CAC ${settingsDraft.customer_acquisition_cost} over ${settingsDraft.expected_bookings_per_customer} bookings, maintenance ${settingsDraft.maintenance_monthly}/mo.`;
      await savePlatformSettings(settingsDraft, summary);
      onDataChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the pricing defaults.');
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof RobotPricing>(key: K, value: RobotPricing[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-ink-50">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
              <BarChart3 size={20} className="text-brand-700" /> Pricing Management
            </h1>
            <button onClick={onBack} className="text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors">
              Back to site
            </button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-20">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 text-center">
            <span className="w-12 h-12 rounded-2xl bg-ink-100 text-ink-600 flex items-center justify-center mx-auto">
              <Lock size={22} />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-ink-950">Administrators only</h2>
            <p className="mt-2 text-sm text-ink-500 leading-relaxed">
              Cost and pricing settings can only be changed by designated administrator accounts. If you need access, ask an existing administrator to add your account.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <h1 className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
            <BarChart3 size={20} className="text-brand-700" /> Pricing Management
          </h1>
          <button onClick={onBack} className="text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors">
            Back to site
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-28 md:pb-12">
        {adminError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{adminError}</div>
        )}

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-brand-700" /> Administrators</h2>
          <p className="text-xs text-ink-500 mt-0.5">Only these accounts can change costs, pricing rules, or catalog prices. Changes here are enforced by the database.</p>
          <ul className="mt-4 space-y-2">
            {adminRows.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between gap-3 border border-ink-100 rounded-xl px-4 py-2.5 text-sm">
                <span className="font-medium text-ink-900 truncate">{a.email ?? a.user_id}</span>
                {a.user_id !== currentUserId ? (
                  <button onClick={() => handleRemoveAdmin(a.user_id)} disabled={saving} className="text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
                    <UserMinus size={14} className="inline -mt-0.5 mr-1" /> Remove
                  </button>
                ) : (
                  <span className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1 shrink-0">You</span>
                )}
              </li>
            ))}
            {adminRows.length === 0 && <li className="text-sm text-ink-500">Loading administrators...</li>}
          </ul>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Add an administrator by email"
              className="flex-1 border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleAddAdmin} disabled={saving || !newAdminEmail.trim()} className="inline-flex items-center justify-center gap-2 bg-ink-950 hover:bg-ink-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
              <UserPlus size={15} /> Add admin
            </button>
          </div>
        </section>
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{saveError}</div>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Fleet monthly revenue" value={formatMoney(fleet.revenue)} icon={<TrendingUp size={18} />} />
          <StatCard label="Fleet fixed costs / mo" value={formatMoney(fleet.fixedCost)} />
          <StatCard label="Fleet contribution profit" value={formatMoney(fleet.profit)} sub={`${Math.round(fleet.margin * 100)}% margin`} />
          <StatCard label="Robots with cost warnings" value={String(fleet.missing)} warn={fleet.missing > 0} />
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold">Utilization scenarios</h2>
              <p className="text-xs text-ink-500 mt-0.5">Fixed fleet costs are allocated across revenue-producing periods at each level. Rows flagged red miss the contribution-margin target at the current prices.</p>
            </div>
            <div className="flex gap-2">
              {UTILIZATION_LEVELS.map((u) => (
                <button
                  key={u}
                  onClick={() => setUtilizationLevel(u)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    utilizationLevel === u ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                  }`}
                >
                  {Math.round(u * 100)}%
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">Per-robot pricing</h2>
          {robots.map((robot) => {
            const p = pricingByRobot.get(robot.id);
            const q = quotes.get(robot.id);
            if (!p || !q) return null;
            const isEditing = editingRobotId === robot.id;
            return (
              <article key={robot.id} className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <img src={robot.image_url} alt={robot.name} className="w-full lg:w-24 h-32 lg:h-16 object-cover rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-lg">{robot.name}</h3>
                    <p className="text-xs text-ink-500">
                      {p.manufacturer} · {p.cost_category === 'window_cleaning' ? 'Window cleaning' : p.cost_category} · {p.financing_method === 'owned' ? `owned, acquired ${formatMoney(p.wholesale_cost + p.battery_cost + p.refurbishment_cost)}` : `${p.financing_method.replace('_', ' ')} ${formatMoney(p.monthly_payment)}/mo`}
                      {' '}· fixed {formatMoney(q.breakdown.totalFixedMonthly)}/mo (depreciation {formatMoney(q.breakdown.capitalMonthly)}, CAC {formatMoney(q.breakdown.cacAllocation)}/mo)
                    </p>
                    <UtilizationTable p={p} settings={settingsDraft} />
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5">Utilization {Math.round(q.utilization * 100)}% · {q.monthlyBookings.toFixed(1)} bookings/mo</span>
                      <span className="rounded-full bg-ink-100 px-2 py-0.5">Revenue {formatMoney(q.monthlyRevenue)}/mo</span>
                      <span className={`rounded-full px-2 py-0.5 ${q.contributionProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        Profit {formatMoney(q.contributionProfit)} ({Math.round(q.contributionMargin * 100)}%)
                      </span>
                      <span className="rounded-full bg-ink-100 px-2 py-0.5">Break-even {isFinite(q.breakEvenBookings) ? `${q.breakEvenBookings} bookings (${Math.round(q.breakEvenUtilization * 100)}%)` : 'unreachable'}</span>
                    </div>
                    {q.missingCosts.length > 0 && (
                      <div className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>{q.missingCosts.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <button onClick={() => (isEditing ? (setEditingRobotId(null), setDraft(null)) : startEdit(robot.id))} className="px-4 py-2 rounded-xl text-sm font-semibold border border-ink-200 hover:border-ink-400 transition-colors">
                      {isEditing ? 'Close' : 'Edit costs'}
                    </button>
                    <button onClick={() => applyToCatalog(robot.id)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-60 transition-colors">
                      Apply prices to catalog
                    </button>
                  </div>
                </div>

                <div className="border-t border-ink-100 px-5 py-4 grid sm:grid-cols-3 gap-4 text-sm">
                  {(['daily', 'weekly', 'monthly'] as const).map((d) => {
                    const dq = q.quotes[d];
                    return (
                      <div key={d} className="bg-ink-50 rounded-xl p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{d} price</p>
                        <p className="mt-1 font-display text-xl font-bold">{formatMoney(dq.price)}</p>
                        <p className="text-xs text-ink-500 mt-0.5">≈ {formatMoney(dq.effectiveDaily)}/day effective</p>
                        <p className="text-xs text-ink-400 mt-1">Zero-margin floor {formatMoney(dq.floorPrice)}{dq.overrideUsed ? ' · override used' : ''}{dq.belowFloor ? ' · below floor!' : ''}</p>
                      </div>
                    );
                  })}
                </div>

                {isEditing && draft && (
                  <div className="border-t border-ink-100 bg-ink-50/60 p-5 space-y-5">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <TextField label="Manufacturer" value={draft.manufacturer} onChange={(v) => updateDraft('manufacturer', v)} />
                      <TextField label="Model name" value={draft.model_name} onChange={(v) => updateDraft('model_name', v)} />
                      <SelectField
                        label="Category"
                        value={draft.cost_category}
                        options={[['residential', 'Residential'], ['prosumer', 'Prosumer'], ['commercial', 'Commercial'], ['window_cleaning', 'Window cleaning']]}
                        onChange={(v) => updateDraft('cost_category', v as RobotPricing['cost_category'])}
                      />
                      <NumberField label="Used robot purchase ($)" value={draft.wholesale_cost} onChange={(v) => updateDraft('wholesale_cost', v)} />
                      <NumberField label="New battery ($)" value={draft.battery_cost} onChange={(v) => updateDraft('battery_cost', v)} />
                      <NumberField label="Other refurbishment ($)" value={draft.refurbishment_cost} onChange={(v) => updateDraft('refurbishment_cost', v)} />
                      <NumberField label="Customer acquisition cost ($ one-time)" value={draft.customer_acquisition_cost} onChange={(v) => updateDraft('customer_acquisition_cost', v)} />
                      <NumberField label="Expected bookings per customer" value={draft.expected_bookings_per_customer} onChange={(v) => updateDraft('expected_bookings_per_customer', v)} />
                      <NumberField label="Handoff incentive ($ per handoff)" value={draft.handoff_incentive} onChange={(v) => updateDraft('handoff_incentive', v)} />
                      <SelectField
                        label="Financing method"
                        value={draft.financing_method}
                        options={[['owned', 'Owned'], ['financed', 'Financed'], ['supplier_leased', 'Supplier-leased']]}
                        onChange={(v) => updateDraft('financing_method', v as RobotPricing['financing_method'])}
                      />
                      <NumberField label="Monthly lease/financing payment ($)" value={draft.monthly_payment} onChange={(v) => updateDraft('monthly_payment', v)} />
                      <NumberField label="Financing term (months)" value={draft.term_months} onChange={(v) => updateDraft('term_months', v)} />
                      <NumberField label="Interest rate (%)" value={draft.rate_pct} onChange={(v) => updateDraft('rate_pct', v)} />
                      <NumberField label="Useful life (months)" value={draft.useful_life_months} onChange={(v) => updateDraft('useful_life_months', v)} />
                      <NumberField label="Residual value ($)" value={draft.residual_value} onChange={(v) => updateDraft('residual_value', v)} />
                      {monthlyFields.map((f) => (
                        <NumberField key={f.key} label={f.label} value={Number(draft[f.key])} onChange={(v) => updateDraft(f.key, v as never)} />
                      ))}
                      {bookingFields.map((f) => (
                        <NumberField key={f.key} label={f.label} value={Number(draft[f.key])} onChange={(v) => updateDraft(f.key, v as never)} />
                      ))}
                      <NumberField label="Processing rate (%)" value={draft.processing_pct} onChange={(v) => updateDraft('processing_pct', v)} step="0.001" />
                      <NumberField label="Expected utilization (0-1)" value={draft.expected_utilization} onChange={(v) => updateDraft('expected_utilization', v)} step="0.05" />
                      <NumberField label="Expected monthly bookings" value={draft.expected_monthly_bookings} onChange={(v) => updateDraft('expected_monthly_bookings', v)} />
                      <NumberField label="Marketing rate (%)" value={draft.marketing_rate} onChange={(v) => updateDraft('marketing_rate', v)} step="0.01" />
                      <NumberField label="Target contribution margin (%)" value={draft.target_margin} onChange={(v) => updateDraft('target_margin', v)} step="0.01" />
                      <NumberField label="Tax rate (%)" value={draft.tax_rate} onChange={(v) => updateDraft('tax_rate', v)} step="0.01" />
                      <NumberField label="Refundable deposit ($)" value={draft.deposit_amount} onChange={(v) => updateDraft('deposit_amount', v)} />
                      <NumberField label="Daily price override ($)" value={draft.daily_override ?? ''} onChange={(v) => updateDraft('daily_override', v === '' ? null : v)} nullable />
                      <NumberField label="Weekly price override ($)" value={draft.weekly_override ?? ''} onChange={(v) => updateDraft('weekly_override', v === '' ? null : v)} nullable />
                      <NumberField label="Monthly price override ($)" value={draft.monthly_override ?? ''} onChange={(v) => updateDraft('monthly_override', v === '' ? null : v)} nullable />
                      <SelectField
                        label="Distribution hub"
                        value={draft.hub_id ?? ''}
                        options={[['', 'Unassigned'], ...hubs.map((h) => [h.id, h.name] as [string, string])]}
                        onChange={(v) => updateDraft('hub_id', v || null)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.wholesale_verified} onChange={(e) => updateDraft('wholesale_verified', e.target.checked)} className="w-4 h-4 accent-brand-600" />
                        Wholesale cost verified
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.payment_verified} onChange={(e) => updateDraft('payment_verified', e.target.checked)} className="w-4 h-4 accent-brand-600" />
                        Financing payment verified
                      </label>
                    </div>
                    <button onClick={saveDraft} disabled={saving} className="inline-flex items-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
                      <Save size={16} /> {saving ? 'Saving...' : 'Save cost configuration'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold">Platform defaults</h2>
          <p className="text-xs text-ink-500 mt-0.5">Applied to robots without a robot-specific value. Editable until verified supplier quotes arrive.</p>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField label="Target contribution margin" value={settingsDraft.target_margin} onChange={(v) => setSettingsDraft((s) => ({ ...s, target_margin: v }))} step="0.01" />
            <NumberField label="New battery default ($)" value={settingsDraft.battery_cost} onChange={(v) => setSettingsDraft((s) => ({ ...s, battery_cost: v }))} />
            <NumberField label="Other refurbishment default ($)" value={settingsDraft.refurbishment_cost} onChange={(v) => setSettingsDraft((s) => ({ ...s, refurbishment_cost: v }))} />
            <NumberField label="Useful life (months)" value={settingsDraft.useful_life_months} onChange={(v) => setSettingsDraft((s) => ({ ...s, useful_life_months: v }))} />
            <NumberField label="Maintenance reserve ($/mo)" value={settingsDraft.maintenance_monthly} onChange={(v) => setSettingsDraft((s) => ({ ...s, maintenance_monthly: v }))} />
            <NumberField label="Hosting allocation ($/robot/mo)" value={settingsDraft.hosting_monthly} onChange={(v) => setSettingsDraft((s) => ({ ...s, hosting_monthly: v }))} />
            <NumberField label="Insurance ($/robot/mo, optional)" value={settingsDraft.insurance_monthly} onChange={(v) => setSettingsDraft((s) => ({ ...s, insurance_monthly: v }))} />
            <NumberField label="Customer acquisition cost ($ one-time)" value={settingsDraft.customer_acquisition_cost} onChange={(v) => setSettingsDraft((s) => ({ ...s, customer_acquisition_cost: v }))} />
            <NumberField label="Expected bookings per customer" value={settingsDraft.expected_bookings_per_customer} onChange={(v) => setSettingsDraft((s) => ({ ...s, expected_bookings_per_customer: v }))} />
            <NumberField label="Handoff incentive ($ per handoff)" value={settingsDraft.handoff_incentive} onChange={(v) => setSettingsDraft((s) => ({ ...s, handoff_incentive: v }))} />
            <NumberField label="Processing rate" value={settingsDraft.processing_pct} onChange={(v) => setSettingsDraft((s) => ({ ...s, processing_pct: v }))} step="0.001" />
            <NumberField label="Processing fixed fee ($)" value={settingsDraft.processing_fixed} onChange={(v) => setSettingsDraft((s) => ({ ...s, processing_fixed: v }))} step="0.01" />
            <NumberField label="Hub storage ($/robot/mo, fallback)" value={settingsDraft.storage_monthly} onChange={(v) => setSettingsDraft((s) => ({ ...s, storage_monthly: v }))} />
            <NumberField label="Checkout handling ($, fallback)" value={settingsDraft.checkout_handling} onChange={(v) => setSettingsDraft((s) => ({ ...s, checkout_handling: v }))} />
            <NumberField label="Return handling ($, fallback)" value={settingsDraft.return_handling} onChange={(v) => setSettingsDraft((s) => ({ ...s, return_handling: v }))} />
            <NumberField label="Software ($/robot/mo)" value={settingsDraft.software_monthly} onChange={(v) => setSettingsDraft((s) => ({ ...s, software_monthly: v }))} />
            <NumberField label="Base utilization (0-1)" value={settingsDraft.utilization_base} onChange={(v) => setSettingsDraft((s) => ({ ...s, utilization_base: v }))} step="0.05" />
            <NumberField label="Weekly discount target" value={settingsDraft.weekly_discount} onChange={(v) => setSettingsDraft((s) => ({ ...s, weekly_discount: v }))} step="0.01" />
            <NumberField label="Monthly discount target" value={settingsDraft.monthly_discount} onChange={(v) => setSettingsDraft((s) => ({ ...s, monthly_discount: v }))} step="0.01" />
            <NumberField label="Tax rate" value={settingsDraft.tax_rate} onChange={(v) => setSettingsDraft((s) => ({ ...s, tax_rate: v }))} step="0.01" />
            <NumberField label="Average booking length (days)" value={settingsDraft.avg_booking_days} onChange={(v) => setSettingsDraft((s) => ({ ...s, avg_booking_days: v }))} />
            <NumberField label="Late-handoff grace (minutes)" value={settingsDraft.late_grace_minutes} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_grace_minutes: v }))} />
            <NumberField label="Late-handoff warning (minutes)" value={settingsDraft.late_warn_minutes} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_warn_minutes: v }))} />
            <NumberField label="Late-handoff fee ($)" value={settingsDraft.late_fee_amount} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_fee_amount: v }))} />
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={settingsDraft.late_fee_active} onChange={(e) => setSettingsDraft((s) => ({ ...s, late_fee_active: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
              Late-handoff fees active (requires legal approval)
            </label>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={settingsDraft.verified} onChange={(e) => setSettingsDraft((s) => ({ ...s, verified: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
              All default assumptions verified
            </label>
          </div>
          <button onClick={saveSettings} disabled={saving} className="mt-4 inline-flex items-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
            <Save size={16} /> {saving ? 'Saving...' : 'Save platform defaults'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><Building2 size={18} /> Profitability per hub</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
                  <th className="py-2 pr-4">Hub</th>
                  <th className="py-2 pr-4">Robots</th>
                  <th className="py-2 pr-4">Capacity</th>
                  <th className="py-2 pr-4">Revenue / mo</th>
                  <th className="py-2">Contribution profit</th>
                </tr>
              </thead>
              <tbody>
                {hubStats.map(([id, s]) => (
                  <tr key={id} className="border-b border-ink-50">
                    <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                    <td className="py-2.5 pr-4">{s.robots}</td>
                    <td className="py-2.5 pr-4">{s.capacity}</td>
                    <td className="py-2.5 pr-4">{formatMoney(s.revenue)}</td>
                    <td className={`py-2.5 font-semibold ${s.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><History size={18} /> Pricing change history</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-ink-500 mt-3">No pricing changes recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {audit.slice(0, 15).map((a) => (
                <li key={a.id} className="border border-ink-100 rounded-xl px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{a.scope}</span>
                  <p className="text-ink-700 mt-0.5">{a.summary}</p>
                  <p className="text-xs text-ink-400 mt-1">{new Date(a.created_at).toLocaleString('en-US')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function UtilizationTable({ p, settings }: { p: RobotPricing; settings: PricingSettings }) {
  const rows = utilizationTable(p, settings);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-400 border-b border-ink-100">
            <th className="py-1.5 pr-3 font-semibold">Utilization</th>
            <th className="py-1.5 pr-3 font-semibold">Revenue/mo</th>
            <th className="py-1.5 pr-3 font-semibold">Cost/mo</th>
            <th className="py-1.5 pr-3 font-semibold">Contribution profit</th>
            <th className="py-1.5 pr-3 font-semibold">Margin</th>
            <th className="py-1.5 font-semibold">24-mo profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.utilization} className={`border-b border-ink-50 ${r.meetsTarget ? '' : 'text-red-700'}`}>
              <td className="py-1.5 pr-3 font-medium">{Math.round(r.utilization * 100)}%</td>
              <td className="py-1.5 pr-3">{formatMoney(r.monthlyRevenue)}</td>
              <td className="py-1.5 pr-3">{formatMoney(r.monthlyCost)}</td>
              <td className="py-1.5 pr-3">{formatMoney(r.contributionProfit)}</td>
              <td className="py-1.5 pr-3">{Math.round(r.contributionMargin * 100)}%{r.meetsTarget ? '' : ' · below target'}</td>
              <td className="py-1.5">{formatMoney(r.contributionProfit * 24)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, sub, warn, icon }: { label: string; value: string; sub?: string; warn?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${warn ? 'border-amber-300 bg-amber-50' : 'border-ink-100'}`}>
      <p className="text-xs font-semibold text-ink-500 flex items-center gap-2">{icon}{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink-950">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600 mb-1 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </label>
  );
}

type NumberFieldProps =
  | { label: string; value: number | ''; step?: string; nullable?: false; onChange: (v: number) => void }
  | { label: string; value: number | ''; step?: string; nullable: true; onChange: (v: number | '') => void };

function NumberField({ label, value, step, nullable, onChange }: NumberFieldProps) {
  const emit = onChange as (v: number | '') => void;
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600 mb-1 block">{label}</span>
      <input
        type="number"
        step={step ?? '0.01'}
        value={value}
        onChange={(e) => emit(e.target.value === '' ? (nullable ? '' : 0) : Number(e.target.value))}
        className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600 mb-1 block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
