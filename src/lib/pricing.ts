export type DurationType = 'daily' | 'weekly' | 'monthly';
export type FinancingMethod = 'owned' | 'financed' | 'supplier_leased';
export type CostCategory = 'residential' | 'prosumer' | 'commercial';
export type ScenarioName = 'conservative' | 'base' | 'optimistic';

export interface PricingSettings {
  marketing_rate: number;
  target_margin: number;
  processing_pct: number;
  processing_fixed: number;
  storage_monthly: number;
  insurance_monthly: number;
  maintenance_monthly: number;
  software_monthly: number;
  hosting_monthly: number;
  checkout_handling: number;
  return_handling: number;
  utilization_base: number;
  robots_per_hub: number;
  weekly_discount: number;
  monthly_discount: number;
  tax_rate: number;
  avg_booking_days: number;
  verified: boolean;
}

export interface RobotPricing {
  robot_id: string;
  manufacturer: string;
  model_name: string;
  cost_category: CostCategory;
  retail_price: number;
  wholesale_cost: number;
  wholesale_source: string;
  wholesale_verified: boolean;
  financing_method: FinancingMethod;
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
  marketing_rate: 0.20,
  target_margin: 0.35,
  processing_pct: 0.029,
  processing_fixed: 0.30,
  storage_monthly: 15,
  insurance_monthly: 0,
  maintenance_monthly: 0,
  software_monthly: 0,
  hosting_monthly: 2,
  checkout_handling: 5,
  return_handling: 5,
  utilization_base: 0.80,
  robots_per_hub: 10,
  weekly_discount: 0.12,
  monthly_discount: 0.25,
  tax_rate: 0,
  avg_booking_days: 7,
  verified: false,
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface MonthlyCostBreakdown {
  capitalMonthly: number;
  capitalMethod: 'lease payment' | 'financed payment' | 'straight-line depreciation';
  operatingMonthly: number;
  totalFixedMonthly: number;
}

export function monthlyFixedCost(p: RobotPricing): MonthlyCostBreakdown {
  let capitalMonthly: number;
  let capitalMethod: MonthlyCostBreakdown['capitalMethod'];
  if (p.financing_method === 'owned') {
    // Owned units recover cost through depreciation; no lease/financing payment
    // so principal and depreciation are never double-counted.
    capitalMonthly = Math.max(0, (p.wholesale_cost - p.residual_value) / Math.max(1, p.useful_life_months));
    capitalMethod = 'straight-line depreciation';
  } else {
    capitalMonthly = Math.max(0, p.monthly_payment);
    capitalMethod = p.financing_method === 'financed' ? 'financed payment' : 'lease payment';
  }
  const operatingMonthly =
    p.monthly_storage +
    p.monthly_insurance +
    p.monthly_maintenance +
    p.monthly_software +
    p.monthly_hosting;
  return {
    capitalMonthly: round2(capitalMonthly),
    capitalMethod,
    operatingMonthly: round2(operatingMonthly),
    totalFixedMonthly: round2(capitalMonthly + operatingMonthly),
  };
}

export function utilizationFor(
  p: RobotPricing,
  settings: PricingSettings,
  scenario: ScenarioName,
): number {
  const base = p.expected_utilization > 0 ? p.expected_utilization : settings.utilization_base;
  if (scenario === 'conservative') return round2(Math.max(0, base * 0.6));
  if (scenario === 'optimistic') return round2(Math.min(1, base * 1.25));
  return round2(base);
}

// Denominator of the required-price formula; floored so prices stay finite
// even if marketing + processing + margin rates exceed 100%.
export function marginDenominator(marketingRate: number, processingPct: number, targetMargin: number): number {
  return Math.max(0.05, 1 - marketingRate - processingPct - targetMargin);
}

export interface DurationQuote {
  duration: DurationType;
  days: number;
  price: number;
  effectiveDaily: number;
  allocatedFixed: number;
  handling: number;
  usageMaintenance: number;
  processingFixed: number;
  floorPrice: number;
  discountFromDaily: number;
  overrideUsed: boolean;
  belowFloor: boolean;
}

export interface RobotQuote {
  breakdown: MonthlyCostBreakdown;
  utilization: number;
  monthlyBookings: number;
  avgBookingDays: number;
  quotes: Record<DurationType, DurationQuote>;
  monthlyRevenue: number;
  monthlyHandling: number;
  monthlyUsageMaintenance: number;
  monthlyProcessing: number;
  monthlyMarketing: number;
  contributionProfit: number;
  contributionMargin: number;
  breakEvenBookings: number;
  breakEvenUtilization: number;
  missingCosts: string[];
  taxRate: number;
  deposit: number;
}

export function quoteRobot(
  p: RobotPricing,
  settings: PricingSettings,
  scenario: ScenarioName = 'base',
): RobotQuote {
  const breakdown = monthlyFixedCost(p);
  const utilization = utilizationFor(p, settings, scenario);
  const avgBookingDays = Math.max(1, settings.avg_booking_days);
  const monthlyBookings = Math.round((30 * utilization) / avgBookingDays);

  const perBookingHandling = p.checkout_handling + p.return_handling;
  const maintBase = p.expected_monthly_bookings > 0 ? p.expected_monthly_bookings : Math.max(1, monthlyBookings);
  const maintenancePerBookingDay = (p.monthly_maintenance || 0) / Math.max(1, maintBase * avgBookingDays);

  const marketingRate = p.marketing_rate ?? settings.marketing_rate;
  const targetMargin = p.target_margin ?? settings.target_margin;
  const processingPct = p.processing_pct ?? settings.processing_pct;
  const denominator = marginDenominator(marketingRate, processingPct, targetMargin);

  const plan = (duration: DurationType, days: number, discount: number): DurationQuote => {
    const allocatedFixed = round2(breakdown.totalFixedMonthly * (days / 30));
    const handling = round2(perBookingHandling);
    const usageMaintenance = round2(maintenancePerBookingDay * days);
    const processingFixed = round2(p.processing_fixed);
    const allocatedCost = round2(allocatedFixed + handling + usageMaintenance + processingFixed);
    // Zero-contribution floor: lowest price that still covers every cost
    // including percentage fees. Discounts may never price below this.
    const zeroMarginDenominator = Math.max(0.05, 1 - marketingRate - processingPct);
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
      usageMaintenance,
      processingFixed,
      floorPrice,
      discountFromDaily: 0,
      overrideUsed: override != null,
      belowFloor: override != null && price < floorPrice,
    };
  };

  const daily = plan('daily', avgBookingDays, 0);
  const weekly = plan('weekly', 7, settings.weekly_discount);
  const monthly = plan('monthly', 30, settings.monthly_discount);
  const quotes = { daily, weekly, monthly };

  // Revenue forecast: mix of durations weighted toward monthly as preferred plan.
  // Base case: each active robot-month is filled by whichever plan is booked;
  // we model expected revenue from the average booking length at daily rates
  // plus a share of monthly contracts, per the utilization forecast.
  const activeDaysPerMonth = Math.round(30 * utilization);
  const expectedRevenue = round2((activeDaysPerMonth / avgBookingDays) * daily.price);
  const monthlyHandlingTotal = round2((activeDaysPerMonth / avgBookingDays) * perBookingHandling);
  const monthlyUsageMaintenanceTotal = round2(activeDaysPerMonth * maintenancePerBookingDay);
  const monthlyProcessingTotal = round2(expectedRevenue * processingPct + (activeDaysPerMonth / avgBookingDays) * p.processing_fixed);
  const monthlyMarketingTotal = round2(expectedRevenue * marketingRate);
  const contributionProfit = round2(
    expectedRevenue - breakdown.totalFixedMonthly - monthlyHandlingTotal - monthlyUsageMaintenanceTotal - monthlyProcessingTotal - monthlyMarketingTotal,
  );
  const contributionMargin = expectedRevenue > 0 ? round2(contributionProfit / expectedRevenue) : 0;

  // Break-even: bookings needed so margin-bearing revenue covers fixed costs.
  const perBookingRevenue = daily.price;
  const perBookingVariable = round2(
    perBookingHandling + maintenancePerBookingDay * avgBookingDays + p.processing_fixed + perBookingRevenue * (processingPct + marketingRate),
  );
  const perBookingContribution = round2(perBookingRevenue - perBookingVariable);
  const breakEvenBookings = perBookingContribution > 0
    ? Math.ceil(breakdown.totalFixedMonthly / perBookingContribution)
    : Infinity;
  const breakEvenUtilization = isFinite(breakEvenBookings)
    ? round2(Math.min(1, (breakEvenBookings * avgBookingDays) / 30))
    : 1;

  const missingCosts: string[] = [];
  if (p.wholesale_cost <= 0) missingCosts.push('Wholesale acquisition cost missing — using $0');
  else if (!p.wholesale_verified) missingCosts.push('Wholesale cost is an unverified estimate');
  if (p.financing_method !== 'owned' && p.monthly_payment <= 0) missingCosts.push('Monthly financing/lease payment missing');
  else if (p.financing_method !== 'owned' && !p.payment_verified) missingCosts.push('Financing payment is unverified');
  if (p.monthly_insurance <= 0) missingCosts.push('Insurance cost not configured');
  if (p.monthly_maintenance <= 0) missingCosts.push('Maintenance/consumables reserve not configured');
  if (p.monthly_software <= 0) missingCosts.push('Software/connectivity cost not configured');
  if (p.monthly_storage <= 0) missingCosts.push('Hub storage cost not configured');

  return {
    breakdown,
    utilization,
    monthlyBookings,
    avgBookingDays,
    quotes,
    monthlyRevenue: expectedRevenue,
    monthlyHandling: monthlyHandlingTotal,
    monthlyUsageMaintenance: monthlyUsageMaintenanceTotal,
    monthlyProcessing: monthlyProcessingTotal,
    monthlyMarketing: monthlyMarketingTotal,
    contributionProfit,
    contributionMargin,
    breakEvenBookings,
    breakEvenUtilization,
    missingCosts,
    taxRate: p.tax_rate || settings.tax_rate,
    deposit: p.deposit_amount,
  };
}

// Discount sanity: weekly/monthly must stay above their own margin floors,
// which the plan() function guarantees by discounting the floor itself.
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
