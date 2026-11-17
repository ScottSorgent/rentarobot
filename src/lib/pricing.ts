export type CostCategory = 'residential' | 'prosumer' | 'commercial' | 'window_cleaning';

export type RentalDuration = 'daily' | 'weekly' | 'monthly';

// Peer-to-peer marketplace settings: Rent-A-Robot does not own robots and
// does not set list prices. Owners list their own rates; the platform earns
// a commission on each transaction.
export interface PricingSettings {
  // Platform take from each rental transaction (0.20 = 20% platform, 80% owner).
  commission_pct: number;
  // Payment processing, deducted before the split.
  processing_pct: number;
  processing_fixed: number;
  // Internal platform expense allocations (never added to the renter price).
  marketing_rate: number;
  hosting_monthly: number;
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

// Owner-side listing economics. Owners set their own daily/weekly/monthly
// rates; the platform only takes its commission.
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
  commission_pct: 0.2,
  processing_pct: 0.029,
  processing_fixed: 0.3,
  marketing_rate: 0.2,
  hosting_monthly: 1,
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

// Rental pricing algorithm: the owner states what the robot is worth and the
// platform derives the rental rate from that value. 8% of value per month —
// a $2,500 robot rents for $200/month, a $500 robot for $40/month.
export const MONTHLY_RATE_PCT_OF_VALUE = 0.08;

export function monthlyRateFromValue(robotValue: number): number {
  const v = Math.max(0, Number(robotValue) || 0);
  if (v <= 0) return 0;
  return round2(Math.max(5, v * MONTHLY_RATE_PCT_OF_VALUE));
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

// Owner rates for one listing, per supported duration. Non-humanoid robots
// only list monthly; humanoid robots can list all three.
export interface OwnerRates {
  monthly: number;
  daily: number | null;
  weekly: number | null;
}

// The rate the renter pays for one unit of the chosen duration. Never
// derived by multiplying another duration's rate: if the owner defined a
// separate rate for the duration, that rate is used as-is.
export function rateForDuration(rates: OwnerRates, duration: RentalDuration): number | null {
  if (duration === 'monthly') return rates.monthly > 0 ? rates.monthly : null;
  if (duration === 'weekly') return rates.weekly && rates.weekly > 0 ? rates.weekly : null;
  return rates.daily && rates.daily > 0 ? rates.daily : null;
}



// What the renter pays: the owner's rate for the chosen duration, times the
// number of duration units, plus tax when configured. No platform service
// fee is added — the commission comes out of the owner's side.
export interface RenterQuote {
  duration: RentalDuration;
  unitPrice: number;
  units: number;
  subtotal: number;
  tax: number;
  total: number;
}

export function quoteRental(
  rates: OwnerRates,
  duration: RentalDuration,
  units: number,
  settings: PricingSettings,
): RenterQuote {
  const unitPrice = rateForDuration(rates, duration);
  if (unitPrice == null) throw new Error(`Owner has not listed a ${duration} rate for this robot.`);
  const safeUnits = Math.max(1, Math.ceil(units));
  const subtotal = round2(unitPrice * safeUnits);
  const tax = round2(subtotal * (settings.tax_rate || 0));
  return { duration, unitPrice, units: safeUnits, subtotal, tax, total: round2(subtotal + tax) };
}

// Marketplace split for one rental transaction. Commission is a share of the
// renter's payment; it is never added on top of the customer's price.
export interface MarketplaceSplit {
  grossPayment: number;
  commission: number;
  processing: number;
  platformEarnings: number;
  ownerPayout: number;
  // Internal allocations, informational only.
  marketingExpense: number;
  hostingAllocation: number;
}

export function splitPayment(
  renterTotal: number,
  settings: PricingSettings,
  duration: RentalDuration,
): MarketplaceSplit {
  const gross = round2(Math.max(0, renterTotal));
  const commission = round2(gross * Math.max(0, settings.commission_pct));
  const processing = round2(gross * settings.processing_pct + settings.processing_fixed);
  const ownerPayout = Math.max(0, round2(gross - commission - processing));
  const marketingExpense = round2(commission * Math.max(0, settings.marketing_rate));
  // $1 per monthly rental; shorter periods get no hosting allocation unless
  // a rule defines one.
  const hostingAllocation = duration === 'monthly' ? round2(settings.hosting_monthly) : 0;
  return {
    grossPayment: gross,
    commission,
    processing,
    platformEarnings: commission,
    ownerPayout,
    marketingExpense,
    hostingAllocation,
  };
}

export interface ListingQuote {
  utilization: number;
  transactionsPerYear: number;
  renterTotal: number;
  commission: number;
  platformEarnings: number;
  ownerEarnings: number;
}

// Annualized economics for one listing at a given utilization: the number of
// booked months per year drives everything; each booked month splits 20/80.
// Fractional booked months are kept as-is — this is a planning model, not a
// checkout quote, so 80% utilization means 9.6 billed months, not 10.
export function quoteListingMonthly(
  monthlyRate: number,
  settings: PricingSettings,
  utilizationOverride?: number,
): ListingQuote {
  const utilization = round2(Math.min(1, Math.max(0, utilizationOverride ?? settings.utilization_base)));
  const transactionsPerYear = round2(12 * utilization);
  const renterTotal = round2(monthlyRate * transactionsPerYear);
  const commission = round2(renterTotal * Math.max(0, settings.commission_pct));
  const processing = round2(renterTotal * settings.processing_pct + settings.processing_fixed);
  return {
    utilization,
    transactionsPerYear,
    renterTotal,
    commission,
    platformEarnings: commission,
    ownerEarnings: Math.max(0, round2(renterTotal - commission - processing)),
  };
}

export interface UtilizationRow {
  utilization: number;
  monthsBooked: number;
  renterTotal: number;
  platformEarnings: number;
  ownerEarnings: number;
}

export function utilizationTable(monthlyRate: number, settings: PricingSettings): UtilizationRow[] {
  const rows: UtilizationRow[] = [];
  for (const level of UTILIZATION_LEVELS) {
    const u = scenarioUtilization(settings, level);
    const q = quoteListingMonthly(monthlyRate, settings, u);
    rows.push({
      utilization: u,
      monthsBooked: q.transactionsPerYear,
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
