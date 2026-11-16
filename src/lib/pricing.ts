export type CostCategory = 'residential' | 'prosumer' | 'commercial' | 'window_cleaning';

export interface UtilizationScenarios {
  u60: number;
  u70: number;
  u80: number;
  u90: number;
  u100: number;
}

// Peer-to-peer marketplace settings: Rent-A-Robot does not own robots and
// does not set list prices. Owners list monthly; the platform earns a
// commission on each transaction plus a flat renter-paid service fee.
export interface PricingSettings {
  // Platform take from each monthly transaction.
  commission_pct: number;
  service_fee_flat: number;
  // Payment processing (deducted from the owner's payout or platform share).
  processing_pct: number;
  processing_fixed: number;
  // Booking rules.
  min_lease_months: number;
  tax_rate: number;
  // Utilization scenario grid (occupancy of a listed robot).
  utilization_base: number;
  u60: number;
  u70: number;
  u80: number;
  u90: number;
  u100: number;
  // Late-handoff policy (inactive until legally approved).
  late_grace_minutes: number;
  late_warn_minutes: number;
  late_fee_amount: number;
  late_fee_active: boolean;
  target_margin: number;
  verified: boolean;
}

// Owner-side listing economics. The owner's costs are theirs; the platform
// models them only to show an owner earnings estimate, never to set prices.
export interface RobotPricing {
  robot_id: string;
  manufacturer: string;
  model_name: string;
  cost_category: CostCategory;
  owner_monthly_price: number;
  min_lease_months_override: number | null;
  retail_price: number;
  wholesale_source: string;
  wholesale_verified: boolean;
  hub_id: string | null;
}

export interface Hub {
  id: string;
  name: string;
  city: string;
  zip: string;
  robot_capacity: number;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  commission_pct: 0.15,
  service_fee_flat: 25,
  processing_pct: 0.029,
  processing_fixed: 0.3,
  min_lease_months: 1,
  tax_rate: 0,
  utilization_base: 0.8,
  u60: 0.6,
  u70: 0.7,
  u80: 0.8,
  u90: 0.9,
  u100: 1.0,
  late_grace_minutes: 15,
  late_warn_minutes: 30,
  late_fee_amount: 5,
  late_fee_active: false,
  target_margin: 0.5,
  verified: false,
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const UTILIZATION_LEVELS = [0.6, 0.7, 0.8, 0.9, 1.0] as const;

export function scenarioUtilization(settings: PricingSettings, level: 0.6 | 0.7 | 0.8 | 0.9 | 1.0): number {
  const map: Record<string, number> = {
    '0.6': settings.u60,
    '0.7': settings.u70,
    '0.8': settings.u80,
    '0.9': settings.u90,
    '1': settings.u100,
  };
  const v = map[String(level)];
  return round2(Math.min(1, Math.max(0, v > 0 ? v : level)));
}

// What the renter pays for one month: the owner's list price plus the flat
// service fee, plus tax when configured.
export interface RenterQuote {
  listPrice: number;
  serviceFee: number;
  tax: number;
  total: number;
}

export function quoteRenterMonthly(
  ownerMonthlyPrice: number,
  settings: PricingSettings,
  months = 1,
): RenterQuote {
  const list = round2(Math.max(0, ownerMonthlyPrice) * Math.max(1, months));
  const serviceFee = round2(Math.max(0, settings.service_fee_flat) * Math.max(1, months));
  const base = round2(list + serviceFee);
  const tax = round2(base * (settings.tax_rate || 0));
  return { listPrice: list, serviceFee, tax, total: round2(base + tax) };
}

// What the platform and the owner each earn on one monthly booking.
export interface MarketplaceSplit {
  grossPayment: number;
  serviceFee: number;
  commission: number;
  processing: number;
  platformEarnings: number;
  ownerPayout: number;
}

export function splitMonthlyPayment(
  ownerMonthlyPrice: number,
  settings: PricingSettings,
  months = 1,
): MarketplaceSplit {
  const quote = quoteRenterMonthly(ownerMonthlyPrice, settings, months);
  const commission = round2(quote.listPrice * Math.max(0, settings.commission_pct));
  const processing = round2(quote.total * settings.processing_pct + settings.processing_fixed);
  const platformEarnings = round2(commission + quote.serviceFee - processing);
  const ownerPayout = round2(quote.listPrice - commission - processing);
  return {
    grossPayment: quote.total,
    serviceFee: quote.serviceFee,
    commission,
    processing,
    platformEarnings,
    ownerPayout: Math.max(0, ownerPayout),
  };
}

export interface ListingQuote {
  utilization: number;
  monthsBooked: number;
  renterTotal: number;
  platformEarnings: number;
  ownerEarnings: number;
  commission: number;
  serviceFee: number;
  processing: number;
}

// Platform economics for one listed robot at a given utilization: months
// booked per year drive everything; each booked month splits per the rates.
export function quoteListing(
  p: Pick<RobotPricing, 'owner_monthly_price'>,
  settings: PricingSettings,
  utilizationOverride?: number,
): ListingQuote {
  const utilization = round2(Math.min(1, Math.max(0, utilizationOverride ?? settings.utilization_base)));
  const monthsBooked = round2(12 * utilization);
  const split = splitMonthlyPayment(p.owner_monthly_price, settings, monthsBooked);
  return {
    utilization,
    monthsBooked,
    renterTotal: split.grossPayment,
    platformEarnings: split.platformEarnings,
    ownerEarnings: split.ownerPayout,
    commission: split.commission,
    serviceFee: split.serviceFee,
    processing: split.processing,
  };
}

export interface UtilizationRow {
  utilization: number;
  monthsBooked: number;
  renterTotal: number;
  platformEarnings: number;
  ownerEarnings: number;
}

export function utilizationTable(p: Pick<RobotPricing, 'owner_monthly_price'>, settings: PricingSettings): UtilizationRow[] {
  const rows: UtilizationRow[] = [];
  for (const level of UTILIZATION_LEVELS) {
    const u = scenarioUtilization(settings, level);
    const q = quoteListing(p, settings, u);
    rows.push({
      utilization: u,
      monthsBooked: q.monthsBooked,
      renterTotal: q.renterTotal,
      platformEarnings: q.platformEarnings,
      ownerEarnings: q.ownerEarnings,
    });
  }
  return rows;
}

// Late-handoff evaluation. Fees only apply when late_fee_active is true;
// otherwise the event is recorded but never charged. One incident yields at
// most one fee.
export type LateOutcome = 'grace' | 'warning' | 'chargeable' | 'missed';

export function evaluateLateHandoff(
  minutesLate: number | null,
  settings: PricingSettings,
): { outcome: LateOutcome; fee: number } {
  if (minutesLate == null || minutesLate <= settings.late_grace_minutes) return { outcome: 'grace', fee: 0 };
  if (minutesLate <= settings.late_warn_minutes) return { outcome: 'warning', fee: 0 };
  if (settings.late_fee_active) return { outcome: 'chargeable', fee: settings.late_fee_amount };
  return { outcome: 'chargeable', fee: 0 };
}
