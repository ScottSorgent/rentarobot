import { AlertTriangle, BarChart3, History, Lock, Save, ShieldCheck, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Robot } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import type { Hub, PricingSettings, RobotPricing, UtilizationRow } from '@/lib/pricing';
import { quoteListing, round2, utilizationTable, UTILIZATION_LEVELS } from '@/lib/pricing';
import { applyCatalogRates, fetchAdminList, removeAdmin, addAdminByEmail, savePlatformSettings } from '@/lib/api';

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

type ListingDraft = Pick<RobotPricing, 'robot_id' | 'owner_monthly_price' | 'min_lease_months_override' | 'hub_id'>;

export default function PricingAdminPage({ robots, pricingByRobot, settings, hubs, audit, isAdmin, currentUserId, onBack, onDataChanged }: Props) {
  const [utilizationLevel, setUtilizationLevel] = useState<0.6 | 0.7 | 0.8 | 0.9 | 1.0>(0.8);
  const [editingRobotId, setEditingRobotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
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

  const listings = useMemo(() => {
    const map = new Map<string, UtilizationRow>();
    for (const robot of robots) {
      const p = pricingByRobot.get(robot.id);
      if (!p) continue;
      const rows = utilizationTable(p, settingsDraft);
      const idx = UTILIZATION_LEVELS.indexOf(utilizationLevel);
      map.set(robot.id, rows[idx]);
    }
    return map;
  }, [robots, pricingByRobot, settingsDraft, utilizationLevel]);

  const marketplace = useMemo(() => {
    let renterTotal = 0;
    let platform = 0;
    let owners = 0;
    for (const robot of robots) {
      const row = listings.get(robot.id);
      if (!row) continue;
      renterTotal += row.renterTotal;
      platform += row.platformEarnings;
      owners += row.ownerEarnings;
    }
    return { renterTotal: round2(renterTotal), platform: round2(platform), owners: round2(owners) };
  }, [robots, listings]);

  const hubStats = useMemo(() => {
    const byHub = new Map<string, { name: string; robots: number; renterTotal: number; platform: number; capacity: number }>();
    for (const hub of hubs) byHub.set(hub.id, { name: hub.name, robots: 0, renterTotal: 0, platform: 0, capacity: hub.robot_capacity });
    for (const robot of robots) {
      const p = pricingByRobot.get(robot.id);
      const row = listings.get(robot.id);
      if (!p || !row) continue;
      const key = p.hub_id ?? 'unassigned';
      if (!byHub.has(key)) byHub.set(key, { name: 'Unassigned', robots: 0, renterTotal: 0, platform: 0, capacity: 10 });
      const entry = byHub.get(key)!;
      entry.robots += 1;
      entry.renterTotal = round2(entry.renterTotal + row.renterTotal);
      entry.platform = round2(entry.platform + row.platformEarnings);
    }
    return Array.from(byHub.entries());
  }, [hubs, robots, pricingByRobot, listings]);

  function startEdit(robotId: string) {
    const p = pricingByRobot.get(robotId);
    if (!p) return;
    setEditingRobotId(robotId);
    setDraft({ robot_id: p.robot_id, owner_monthly_price: p.owner_monthly_price, min_lease_months_override: p.min_lease_months_override, hub_id: p.hub_id });
    setSaveError(null);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const robot = robots.find((r) => r.id === draft.robot_id);
      const summary = `Updated listing for ${robot?.name ?? draft.robot_id}: owner monthly price ${draft.owner_monthly_price}, minimum lease ${draft.min_lease_months_override ?? 'platform default'} months.`;
      await applyCatalogRates(draft.robot_id, { monthly_rate: draft.owner_monthly_price }, summary);
      setEditingRobotId(null);
      setDraft(null);
      onDataChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the listing changes.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaveError(null);
    try {
      const summary = `Updated marketplace terms: commission ${Math.round(settingsDraft.commission_pct * 100)}%, service fee ${settingsDraft.service_fee_flat}/lease, minimum term ${settingsDraft.min_lease_months} month(s).`;
      await savePlatformSettings(settingsDraft, summary);
      onDataChanged();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the marketplace terms.');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-ink-50">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
              <BarChart3 size={20} className="text-brand-700" /> Marketplace Management
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
              Marketplace terms can only be changed by designated administrator accounts. If you need access, ask an existing administrator to add your account.
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
            <BarChart3 size={20} className="text-brand-700" /> Marketplace Management
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
          <p className="text-xs text-ink-500 mt-0.5">Only these accounts can change marketplace terms or catalog prices. Changes here are enforced by the database.</p>
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

        <section className="grid sm:grid-cols-3 gap-4">
          <StatCard label="Renter volume / mo (at utilization)" value={formatMoney(marketplace.renterTotal)} icon={<TrendingUp size={18} />} />
          <StatCard label="Platform earnings / mo" value={formatMoney(marketplace.platform)} sub="Commission + service fee, net of processing" />
          <StatCard label="Owner payouts / mo" value={formatMoney(marketplace.owners)} />
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold">Utilization scenarios</h2>
              <p className="text-xs text-ink-500 mt-0.5">Share of the year each robot is booked. Select a level to filter the per-listing figures below.</p>
            </div>
            <div className="flex gap-2">
              {UTILIZATION_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setUtilizationLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    utilizationLevel === lvl
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                  }`}
                >
                  {Math.round(lvl * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {robots.map((robot) => {
              const p = pricingByRobot.get(robot.id);
              const row = listings.get(robot.id);
              if (!p || !row) return null;
              const isEditing = editingRobotId === robot.id;
              return (
                <article key={robot.id} className="border border-ink-100 rounded-2xl overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="font-display font-semibold">{robot.name}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        Listed at {formatMoney(p.owner_monthly_price)}/mo · min {p.min_lease_months_override ?? settingsDraft.min_lease_months} mo
                        {p.min_lease_months_override == null ? ' (platform default)' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-ink-500">Renter {formatMoney(row.renterTotal)}</span>
                      <span className="font-semibold text-brand-700">Platform {formatMoney(row.platformEarnings)}</span>
                      <span className="text-ink-500">Owner {formatMoney(row.ownerEarnings)}</span>
                    </div>
                  </div>

                  {isEditing && draft && (
                    <div className="border-t border-ink-100 bg-ink-50/60 p-5 space-y-4">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <NumberField
                          label="Owner's monthly price ($)"
                          value={draft.owner_monthly_price}
                          onChange={(v) => setDraft({ ...draft, owner_monthly_price: v })}
                        />
                        <SelectField
                          label="Minimum lease"
                          value={draft.min_lease_months_override == null ? '' : String(draft.min_lease_months_override)}
                          options={[['', 'Platform default'], ['1', '1 month'], ['3', '3 months'], ['6', '6 months'], ['12', '12 months']]}
                          onChange={(v) => setDraft({ ...draft, min_lease_months_override: v === '' ? null : Number(v) })}
                        />
                        <SelectField
                          label="Distribution hub"
                          value={draft.hub_id ?? ''}
                          options={[['', 'Unassigned'], ...hubs.map((h) => [h.id, h.name] as [string, string])]}
                          onChange={(v) => setDraft({ ...draft, hub_id: v || null })}
                        />
                      </div>
                      <button onClick={saveDraft} disabled={saving} className="inline-flex items-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
                        <Save size={16} /> {saving ? 'Saving...' : 'Save listing'}
                      </button>
                    </div>
                  )}

                  <div className="border-t border-ink-100 px-5 py-3 flex items-center justify-between gap-3 bg-white">
                    <UtilizationTable p={p} settings={settingsDraft} />
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => (isEditing ? (setEditingRobotId(null), setDraft(null)) : startEdit(robot.id))} className="px-4 py-2 rounded-xl text-sm font-semibold border border-ink-200 hover:bg-ink-50 transition-colors">
                        {isEditing ? 'Cancel' : 'Edit listing'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold">Marketplace terms</h2>
          <p className="text-xs text-ink-500 mt-0.5">Applied to every booking. Owners set their own monthly prices; these terms set what Rent-A-Robot earns and the booking rules.</p>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField
              label="Platform commission (% of list, 0-1)"
              value={settingsDraft.commission_pct}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, commission_pct: v }))}
              step="0.01"
            />
            <NumberField
              label="Renter service fee ($ per month)"
              value={settingsDraft.service_fee_flat}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, service_fee_flat: v }))}
            />
            <NumberField
              label="Minimum lease (months)"
              value={settingsDraft.min_lease_months}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, min_lease_months: Math.max(1, Math.round(v)) }))}
              step="1"
            />
            <NumberField label="Payment processing (%)" value={settingsDraft.processing_pct} onChange={(v) => setSettingsDraft((s) => ({ ...s, processing_pct: v }))} step="0.001" />
            <NumberField label="Payment processing fixed ($)" value={settingsDraft.processing_fixed} onChange={(v) => setSettingsDraft((s) => ({ ...s, processing_fixed: v }))} step="0.01" />
            <NumberField label="Tax rate (0-1)" value={settingsDraft.tax_rate} onChange={(v) => setSettingsDraft((s) => ({ ...s, tax_rate: v }))} step="0.01" />
            <NumberField label="Base utilization (0-1)" value={settingsDraft.utilization_base} onChange={(v) => setSettingsDraft((s) => ({ ...s, utilization_base: v }))} step="0.05" />
            <NumberField label="Late-handoff grace (minutes)" value={settingsDraft.late_grace_minutes} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_grace_minutes: v }))} />
            <NumberField label="Late-handoff warning (minutes)" value={settingsDraft.late_warn_minutes} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_warn_minutes: v }))} />
            <NumberField label="Late-handoff fee ($)" value={settingsDraft.late_fee_amount} onChange={(v) => setSettingsDraft((s) => ({ ...s, late_fee_amount: v }))} />
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={settingsDraft.late_fee_active} onChange={(e) => setSettingsDraft((s) => ({ ...s, late_fee_active: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
              Late-handoff fees active (requires legal approval)
            </label>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={settingsDraft.verified} onChange={(e) => setSettingsDraft((s) => ({ ...s, verified: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
              All marketplace terms verified
            </label>
          </div>
          <button onClick={saveSettings} disabled={saving} className="mt-4 inline-flex items-center gap-2 bg-ink-950 hover:bg-ink-800 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
            <Save size={16} /> {saving ? 'Saving...' : 'Save marketplace terms'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Missing pricing data</h2>
          <p className="text-xs text-ink-500 mt-0.5">Listings without an owner price row fall back to the legacy catalog monthly rate at checkout.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {robots.filter((r) => !pricingByRobot.has(r.id)).map((r) => (
              <li key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-2.5 text-amber-900">
                {r.name} — no owner listing configuration yet.
              </li>
            ))}
            {robots.every((r) => pricingByRobot.has(r.id)) && <li className="text-ink-500">All listings configured.</li>}
          </ul>
        </section>

        <section className="bg-white rounded-2xl border border-ink-100 p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><History size={18} /> Change history</h2>
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
    <div className="flex-1 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-400 border-b border-ink-100">
            <th className="py-1.5 pr-3 font-semibold">Utilization</th>
            <th className="py-1.5 pr-3 font-semibold">Months booked</th>
            <th className="py-1.5 pr-3 font-semibold">Renter pays</th>
            <th className="py-1.5 pr-3 font-semibold">Platform earns</th>
            <th className="py-1.5 font-semibold">Owner earns</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.utilization} className={`border-b border-ink-50 ${Math.round(r.utilization * 100) === Math.round(settings.utilization_base * 100) ? 'font-semibold text-brand-800' : ''}`}>
              <td className="py-1.5 pr-3">{Math.round(r.utilization * 100)}%</td>
              <td className="py-1.5 pr-3">{r.monthsBooked}/yr</td>
              <td className="py-1.5 pr-3">{formatMoney(r.renterTotal)}</td>
              <td className="py-1.5 pr-3">{formatMoney(r.platformEarnings)}</td>
              <td className="py-1.5">{formatMoney(r.ownerEarnings)}</td>
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

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600 mb-1 block">{label}</span>
      <input
        type="number"
        step={step ?? '0.01'}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
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
