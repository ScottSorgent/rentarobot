export type DurationType = 'daily' | 'weekly' | 'monthly';
export type CostCategory = 'residential' | 'prosumer' | 'commercial' | 'window_cleaning';

export interface UtilizationScenarios {
  u60: number;
  u70: number;
  u80: number;
  u90: number;
  u100: number;
}

export interface PricingSettings {
  // Percentage-of-revenue costs (payment processing; marketing now modeled
  // as one-time CAC below, so this defaults to 0).
  processing_pct: number;
  processing_fixed: number;
  // Refurb acquisition model defaults (per robot).
  battery_cost: number;
  refurbishment_cost: number;
  useful_life_months: number;
  maintenance_monthly: number;
  hosting_monthly: number;
  insurance_monthly: number;
  // One-time cost per new customer, allocated across expected bookings.
  customer_acquisition_cost: number;
  expected_bookings_per_customer: number;
  // Optional fallback services (0 in the peer-to-peer model).
  storage_monthly: number;
  checkout_handling: number;
  return_handling: number;
  handoff_incentive: number;
  software_monthly: number;
  // Utilization scenario grid.
  utilization_base: number;
  u60: number;
  u70: number;
  u80: number;
  u90: number;
  u100: number;
  // Pricing rules.
  weekly_discount: number;
  monthly_discount: number;
  tax_rate: number;
  avg_booking_days: number;
  // Late-handoff policy (inactive until legally approved).
  late_grace_minutes: number;
  late_warn_minutes: number;
  late_fee_amount: number;
  late_fee_active: boolean;
  target_margin: number;
  marketing_rate: number;
  verified: boolean;
}

export interface RobotPricing {
  robot_id: string;
  manufacturer: string;
  model_name: string;
  cost_category: CostCategory;
  // Refurb acquisition: total = wholesale (used unit) + battery + refurbishment.
  wholesale_cost: number;
  battery_cost: number;
  refurbishment_cost: number;
  retail_price: number;
  wholesale_source: string;
  wholesale_verified: boolean;
  financing_method: 'owned' | 'financed' | 'supplier_leased';
  monthly_payment: number;
  term_months: number;
  rate_pct: number;
  payment_verified: boolean;
  useful_life_months: number;
  residual_value: number;
  monthly_storage: number;
  monthly_insurance: number;
  monthly_maintenance: number;
  monthly_software: number;
  monthly_hosting: number;
  checkout_handling: number;
  return_handling: number;
  handoff_incentive: number;
  customer_acquisition_cost: number;
  expected_bookings_per_customer: number;
  processing_pct: number;
  processing_fixed: number;
  expected_utilization: number;
  expected_monthly_bookings: number;
  marketing_rate: number;
  target_margin: number;
  tax_rate: number;
  deposit_amount: number;
  daily_override: number | null;
  weekly_override: number | null;
  monthly_override: number | null;
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
  processing_pct: 0.029,
  processing_fixed: 0.30,
  battery_cost: 40,
  refurbishment_cost: 0,
  useful_life_months: 24,
  maintenance_monthly: 2,
  hosting_monthly: 2,
  insurance_monthly: 0,
  customer_acquisition_cost: 5,
  expected_bookings_per_customer: 6,
  storage_monthly: 0,
  checkout_handling: 0,
  return_handling: 0,
  handoff_incentive: 0,
  software_monthly: 0,
  utilization_base: 0.80,
  u60: 0.6,
  u70: 0.7,
  u80: 0.8,
  u90: 0.9,
  u100: 1.0,
  weekly_discount: 0.12,
  monthly_discount: 0.25,
  tax_rate: 0,
  avg_booking_days: 7,
  late_grace_minutes: 15,
  late_warn_minutes: 30,
  late_fee_amount: 5,
  late_fee_active: false,
  target_margin: 0.5,
  marketing_rate: 0,
  verified: false,
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Refurb acquisition total: used unit + new battery + refurb work.
// The battery is part of the total, never double-counted.
export function acquisitionTotal(p: Pick<RobotPricing, 'wholesale_cost' | 'battery_cost' | 'refurbishment_cost'>): number {
  return round2(Math.max(0, p.wholesale_cost) + Math.max(0, p.battery_cost) + Math.max(0, p.refurbishment_cost));
}

export interface MonthlyCostBreakdown {
  capitalMonthly: number;
  capitalMethod: 'lease payment' | 'financed payment' | 'straight-line depreciation';
  maintenanceMonthly: number;
  hostingMonthly: number;
  insuranceMonthly: number;
  softwareMonthly: number;
  storageMonthly: number;
  cacAllocation: number;
  operatingMonthly: number;
  totalFixedMonthly: number;
}

// One-time CAC spread over the bookings one customer is expected to make.
export function cacAllocation(acquisitionCost: number, expectedBookings: number): number {
  const bookings = Math.max(1, expectedBookings);
  return round2(Math.max(0, acquisitionCost) / bookings);
}

export function monthlyFixedCost(p: RobotPricing): MonthlyCostBreakdown {
  let capitalMonthly: number;
  let capitalMethod: MonthlyCostBreakdown['capitalMethod'];
  if (p.financing_method === 'owned') {
    // Depreciation base includes battery + refurbishment; residual excluded.
    const base = acquisitionTotal(p) - Math.max(0, p.residual_value);
    capitalMonthly = Math.max(0, base) / Math.max(1, p.useful_life_months);
    capitalMethod = 'straight-line depreciation';
  } else {
    capitalMonthly = Math.max(0, p.monthly_payment);
    capitalMethod = p.financing_method === 'financed' ? 'financed payment' : 'lease payment';
  }
  const maintenanceMonthly = Math.max(0, p.monthly_maintenance);
  const hostingMonthly = Math.max(0, p.monthly_hosting);
  const insuranceMonthly = Math.max(0, p.monthly_insurance);
  const softwareMonthly = Math.max(0, p.monthly_software);
  const storageMonthly = Math.max(0, p.monthly_storage);
  const cac = cacAllocation(p.customer_acquisition_cost, p.expected_bookings_per_customer);
  const operatingMonthly = maintenanceMonthly + hostingMonthly + insuranceMonthly + softwareMonthly + storageMonthly + cac;
  return {
    capitalMonthly: round2(capitalMonthly),
    capitalMethod,
    maintenanceMonthly: round2(maintenanceMonthly),
    hostingMonthly: round2(hostingMonthly),
    insuranceMonthly: round2(insuranceMonthly),
    softwareMonthly: round2(softwareMonthly),
    storageMonthly: round2(storageMonthly),
    cacAllocation: cac,
    operatingMonthly: round2(operatingMonthly),
    totalFixedMonthly: round2(capitalMonthly + operatingMonthly),
  };
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

export interface DurationQuote {
  duration: DurationType;
  days: number;
  price: number;
  effectiveDaily: number;
  allocatedFixed: number;
  handling: number;
  processingFixed: number;
  floorPrice: number;
  targetPrice: number;
  overrideUsed: boolean;
  belowFloor: boolean;
}

export interface RobotQuote {
  breakdown: MonthlyCostBreakdown;
  utilization: number;
  monthlyBookings: number;
  avgBookingDays: number;
  quotes: Record<DurationType, DurationQuote>;
  // Monthly figures at the given utilization (prorated fixed costs).
  monthlyRevenue: number;
  monthlyHandling: number;
  monthlyAllocatedFixed: number;
  monthlyProcessing: number;
  contributionProfit: number;
  contributionMargin: number;
  breakEvenBookings: number;
  breakEvenUtilization: number;
  missingCosts: string[];
  taxRate: number;
  deposit: number;
}

// Denominator of the required-price formula; floored so prices stay finite
// even if processing + margin rates exceed 100%.
export function marginDenominator(processingPct: number, targetMargin: number): number {
  return Math.max(0.05, 1 - processingPct - targetMargin);
}

export function quoteRobot(
  p: RobotPricing,
  settings: PricingSettings,
  utilizationOverride?: number,
): RobotQuote {
  const breakdown = monthlyFixedCost(p);
  const utilization = round2(Math.min(1, Math.max(0, utilizationOverride ?? (p.expected_utilization > 0 ? p.expected_utilization : settings.utilization_base))));
  const avgBookingDays = Math.max(1, settings.avg_booking_days);
  const monthlyBookings = Math.max(0, (30 * utilization) / avgBookingDays);

  const perBookingHandling = Math.max(0, p.checkout_handling) + Math.max(0, p.return_handling) + Math.max(0, p.handoff_incentive);
  const processingPct = p.processing_pct ?? settings.processing_pct;
  const targetMargin = p.target_margin ?? settings.target_margin;
  const denominator = marginDenominator(processingPct, targetMargin);

  const plan = (duration: DurationType, days: number, discount: number): DurationQuote => {
    // Fixed costs are prorated to the rental period; variable costs are
    // per-booking. No purchase-price multiplication, no double-counting.
    const allocatedFixed = round2(breakdown.totalFixedMonthly * (days / 30));
    const handling = round2(perBookingHandling);
    const processingFixed = round2(p.processing_fixed);
    const allocatedCost = round2(allocatedFixed + handling + processingFixed);
    // Zero-contribution floor: lowest price covering every cost including
    // percentage fees. Discounts may never price below this.
    const zeroMarginDenominator = Math.max(0.05, 1 - processingPct);
    const floorPrice = round2(allocatedCost / zeroMarginDenominator);
    const targetPrice = round2(allocatedCost / denominator);
    const calculated = round2(targetPrice * (1 - discount));
    const override =
      duration === 'daily' ? p.daily_override : duration === 'weekly' ? p.weekly_override : p.monthly_override;
    const price = override != null ? round2(Math.max(0, override)) : round2(Math.max(floorPrice, calculated));
    return {
      duration,
      days,
      price,
      effectiveDaily: round2(price / days),
      allocatedFixed,
      handling,
      processingFixed,
      floorPrice,
      targetPrice,
      overrideUsed: override != null,
      belowFloor: override != null && price < floorPrice,
    };
  };

  // Daily is priced per single day (the label customers see), weekly over
  // 7 days and monthly over 30 days, each against its own cost allocation.
  const daily = plan('daily', 1, 0);
  const weekly = plan('weekly', 7, settings.weekly_discount);
  const monthly = plan('monthly', 30, settings.monthly_discount);
  const quotes = { daily, weekly, monthly };

  // Monotonicity guards: longer stays must cost more in total while the
  // effective daily rate falls. Monthly must stay below 4 weekly rentals.
  if (weekly.price <= daily.price) {
    weekly.price = round2(daily.price * 7 * (1 + 0.01));
    weekly.effectiveDaily = round2(weekly.price / 7);
  }
  const fourWeeks = round2(weekly.price * 4);
  if (monthly.price <= weekly.price) {
    monthly.price = round2(weekly.price * (1 + 0.01));
    monthly.effectiveDaily = round2(monthly.price / 30);
  }
  if (monthly.price >= fourWeeks) {
    monthly.price = round2(fourWeeks * 0.99);
    monthly.effectiveDaily = round2(monthly.price / 30);
  }

  // Monthly economics at this utilization: revenue from the booking mix.
  // A booking of avg_booking_days is charged at the effective daily rate of
  // the duration bucket it falls into (weekly for 7-day average bookings),
  // not the 1-day price.
  const activeDaysPerMonth = Math.round(30 * utilization);
  const bookingsPerMonth = activeDaysPerMonth / avgBookingDays;
  const mixDuration = durationForDays(avgBookingDays);
  const mixEffectiveDaily = quotes[mixDuration].effectiveDaily;
  const expectedRevenue = round2(activeDaysPerMonth * mixEffectiveDaily);
  const monthlyHandlingTotal = round2(bookingsPerMonth * perBookingHandling);
  const monthlyAllocatedFixed = round2(breakdown.totalFixedMonthly * (activeDaysPerMonth / 30));
  const monthlyProcessingTotal = round2(expectedRevenue * processingPct + bookingsPerMonth * p.processing_fixed);
  const contributionProfit = round2(expectedRevenue - monthlyAllocatedFixed - monthlyHandlingTotal - monthlyProcessingTotal);
  const contributionMargin = expectedRevenue > 0 ? round2(contributionProfit / expectedRevenue) : 0;

  // Break-even: bookings needed so per-booking contribution covers the
  // full monthly fixed cost, at the mix duration's price.
  const perBookingRevenue = round2(mixEffectiveDaily * avgBookingDays);
  const perBookingVariable = round2(perBookingHandling + p.processing_fixed + perBookingRevenue * processingPct);
  const perBookingContribution = round2(perBookingRevenue - perBookingVariable);
  const breakEvenBookings = perBookingContribution > 0
    ? Math.ceil(breakdown.totalFixedMonthly / perBookingContribution)
    : Infinity;
  const breakEvenUtilization = isFinite(breakEvenBookings)
    ? round2(Math.min(1, (breakEvenBookings * avgBookingDays) / 30))
    : 1;

  const missingCosts: string[] = [];
  const acquisition = acquisitionTotal(p);
  if (acquisition <= 0) missingCosts.push('Acquisition cost missing — using $0');
  else if (!p.wholesale_verified) missingCosts.push('Acquisition cost is an unverified estimate');
  if (p.useful_life_months <= 0) missingCosts.push('Useful life not configured');
  if (p.monthly_maintenance <= 0) missingCosts.push('Maintenance reserve not configured');
  if (p.customer_acquisition_cost <= 0) missingCosts.push('Customer acquisition cost not configured');
  if (p.monthly_insurance <= 0) missingCosts.push('Insurance cost not configured (excluded from preliminary figures)');

  return {
    breakdown,
    utilization,
    monthlyBookings,
    avgBookingDays,
    quotes,
    monthlyRevenue: expectedRevenue,
    monthlyHandling: monthlyHandlingTotal,
    monthlyAllocatedFixed,
    monthlyProcessing: monthlyProcessingTotal,
    contributionProfit,
    contributionMargin,
    breakEvenBookings,
    breakEvenUtilization,
    missingCosts,
    taxRate: p.tax_rate || settings.tax_rate,
    deposit: p.deposit_amount,
  };
}

// Utilization scenario table for one robot: profit and margin at each level,
// flagging where the configured prices miss the 50% (or configured) target.
export interface UtilizationRow {
  utilization: number;
  monthlyRevenue: number;
  monthlyCost: number;
  contributionProfit: number;
  contributionMargin: number;
  meetsTarget: boolean;
}

export function utilizationTable(p: RobotPricing, settings: PricingSettings): UtilizationRow[] {
  const target = p.target_margin ?? settings.target_margin;
  const rows: UtilizationRow[] = [];
  for (const level of UTILIZATION_LEVELS) {
    const u = scenarioUtilization(settings, level);
    const q = quoteRobot(p, settings, u);
    rows.push({
      utilization: u,
      monthlyRevenue: q.monthlyRevenue,
      monthlyCost: round2(q.monthlyAllocatedFixed + q.monthlyHandling + q.monthlyProcessing),
      contributionProfit: q.contributionProfit,
      contributionMargin: q.contributionMargin,
      meetsTarget: q.contributionMargin >= target,
    });
  }
  return rows;
}

// 24-month equipment profitability: total contribution profit over the
// remaining useful life at a given utilization, minus nothing else (the
// acquisition cost is already amortized inside monthly depreciation).
export function lifetimeProfitAt(p: RobotPricing, settings: PricingSettings, utilization: number, months = 24): number {
  const q = quoteRobot(p, settings, utilization);
  return round2(q.contributionProfit * months);
}

export function durationForDays(days: number): DurationType {
  if (days <= 6) return 'daily';
  if (days <= 27) return 'weekly';
  return 'monthly';
}

export interface BookingTotals {
  duration: DurationType;
  units: number;
  base: number;
  tax: number;
  deposit: number;
  total: number;
  effectiveDaily: number;
}

export function quoteBookingTotal(
  quote: RobotQuote,
  duration: DurationType,
  days: number,
): BookingTotals {
  const q = quote.quotes[duration];
  const units = duration === 'daily' ? days : duration === 'weekly' ? Math.ceil(days / 7) : Math.ceil(days / 30);
  const base = round2(q.price * units);
  const tax = round2(base * quote.taxRate);
  const total = round2(base + tax);
  return {
    duration,
    units,
    base,
    tax,
    deposit: quote.deposit,
    total,
    effectiveDaily: days > 0 ? round2(total / days) : total,
  };
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
