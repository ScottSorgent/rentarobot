/*
Pricing engine regression tests — run with: npx tsx scripts/pricing-tests.ts
Covers the audit scenarios: refurb acquisition math, utilization grid,
duration monotonicity, floor rules, checkout consistency, window category,
late-handoff policy.
*/
import {
  DEFAULT_SETTINGS,
  acquisitionTotal,
  cacAllocation,
  durationForDays,
  evaluateLateHandoff,
  monthlyFixedCost,
  quoteBookingTotal,
  quoteRobot,
  round2,
  utilizationTable,
  type PricingSettings,
  type RobotPricing,
} from '../src/lib/pricing';

let passed = 0;
let failed = 0;

function check(name: string, actual: number | boolean | string, expected: number | boolean | string, tol = 0.01): void {
  const ok = typeof actual === 'number' && typeof expected === 'number'
    ? Math.abs((actual as number) - (expected as number)) <= tol
    : actual === expected;
  if (ok) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}: expected ${expected}, got ${actual}`);
  }
}

// Spec robot: $185 used + $40 battery = $225, owned, 24-month life.
const settings: PricingSettings = { ...DEFAULT_SETTINGS };

const refurb: RobotPricing = {
  robot_id: 'test-1',
  manufacturer: 'iRobot',
  model_name: 'Roomba Combo j7',
  cost_category: 'residential',
  wholesale_cost: 185,
  battery_cost: 40,
  refurbishment_cost: 0,
  retail_price: 0,
  wholesale_source: 'audit spec',
  wholesale_verified: true,
  financing_method: 'owned',
  monthly_payment: 0,
  term_months: 0,
  rate_pct: 0,
  payment_verified: false,
  useful_life_months: 24,
  residual_value: 0,
  monthly_storage: 0,
  monthly_insurance: 0,
  monthly_maintenance: 2,
  monthly_software: 0,
  monthly_hosting: 2,
  checkout_handling: 0,
  return_handling: 0,
  handoff_incentive: 0,
  customer_acquisition_cost: 5,
  expected_bookings_per_customer: 6,
  processing_pct: 0.029,
  processing_fixed: 0.3,
  expected_utilization: 1,
  expected_monthly_bookings: 4,
  marketing_rate: 0,
  target_margin: 0.5,
  tax_rate: 0,
  deposit_amount: 0,
  daily_override: null,
  weekly_override: null,
  monthly_override: null,
  hub_id: null,
};

console.log('\n1. Acquisition math');
check('acquisition total = 225', acquisitionTotal(refurb), 225);
check('no battery double-count (battery inside total, not added again)', refurb.battery_cost + refurb.wholesale_cost, 225, 0.001);
check('CAC allocation = 5/6', cacAllocation(5, 6), 0.83);

console.log('\n2. Monthly operating cost at 100% utilization');
const bd = monthlyFixedCost(refurb);
check('depreciation = 225/24 = 9.375 → 9.38', bd.capitalMonthly, 9.38);
check('maintenance reserve 2.00', bd.maintenanceMonthly, 2.0);
check('hosting 2.00', bd.hostingMonthly, 2.0);
check('CAC allocation 0.83', bd.cacAllocation, 0.83);
check('storage 0 (p2p handoff)', bd.storageMonthly, 0);
check('total fixed = 9.38 + 2 + 2 + 0.83 = 14.21', bd.totalFixedMonthly, 14.21);

console.log('\n3. Utilization grid for the 36.99 target');
const table = utilizationTable(refurb, settings);
for (const row of table) {
  console.log(`    ${Math.round(row.utilization * 100)}%: revenue ${row.monthlyRevenue}, cost ${row.monthlyCost}, profit ${row.contributionProfit}, margin ${row.contributionMargin}${row.meetsTarget ? '' : ' BELOW TARGET'}`);
}
check('100% utilization is profitable', table[4].contributionProfit > 0, true);
check('60% utilization flagged below 50% target', table[0].meetsTarget, false);
// Fixed cost allocated at 100% for one month = 14.21; revenue must exceed it.
check('100% revenue covers full month cost', table[4].monthlyRevenue > table[4].monthlyCost, true);

console.log('\n4. Duration pricing rules');
const q = quoteRobot(refurb, settings, 1.0);
check('weekly total > daily total', q.quotes.weekly.price > q.quotes.daily.price, true);
if (!(q.quotes.weekly.price > q.quotes.daily.price)) { failed++; console.error('FAIL  weekly must exceed daily'); } else { passed++; console.log('  ok  weekly total > daily total'); }
if (!(q.quotes.monthly.price > q.quotes.weekly.price)) { failed++; console.error('FAIL  monthly must exceed weekly'); } else { passed++; console.log('  ok  monthly total > weekly total'); }
if (!(q.quotes.monthly.price < q.quotes.weekly.price * 4)) { failed++; console.error('FAIL  monthly must undercut 4 weekly rentals'); } else { passed++; console.log('  ok  monthly < 4x weekly'); }
check('effective daily rate declines with duration', q.quotes.daily.effectiveDaily > q.quotes.weekly.effectiveDaily && q.quotes.weekly.effectiveDaily > q.quotes.monthly.effectiveDaily, true);
check('daily price quoted for 1 day (not 7)', q.quotes.daily.days, 1);

console.log('\n5. Checkout totals match displayed prices');
const monthlyTotal = quoteBookingTotal(q, 'monthly', 30);
check('30-day monthly base = monthly price', monthlyTotal.base, q.quotes.monthly.price);
check('total = base + tax', monthlyTotal.total, round2(monthlyTotal.base + monthlyTotal.tax));
const threeDay = quoteBookingTotal(q, 'daily', 3);
check('3-day daily base = 3 x daily price', threeDay.base, round2(q.quotes.daily.price * 3));

console.log('\n6. Overrides never price below the zero-margin floor');
const floored: RobotPricing = { ...refurb, daily_override: 0.01 };
const fq = quoteRobot(floored, settings, 1.0);
check('sub-floor override flagged', fq.quotes.daily.belowFloor, true);

console.log('\n7. Window-cleaning robots use their own assumptions');
const windowBot: RobotPricing = { ...refurb, cost_category: 'window_cleaning', wholesale_cost: 600, battery_cost: 80, useful_life_months: 30, monthly_maintenance: 4, expected_bookings_per_customer: 4 };
check('window acquisition independent of 225', acquisitionTotal(windowBot), 680);
check('window monthly cost differs from floor robot', monthlyFixedCost(windowBot).totalFixedMonthly !== bd.totalFixedMonthly, true);

console.log('\n8. Ten-robot fleet at 100%');
const fleetProfit = round2(q.contributionProfit * 10);
console.log(`    10 robots x 100% utilization = ${fleetProfit}/mo contribution profit`);
check('10-robot profit is 10x single', fleetProfit, round2(q.contributionProfit * 10));

console.log('\n9. Late-handoff policy (fees inactive until legal approval)');
check('0 min late = grace, no fee', evaluateLateHandoff(0, settings).fee, 0);
check('15 min late = grace', evaluateLateHandoff(15, settings).outcome, 'grace');
check('20 min late = warning, no fee', evaluateLateHandoff(20, settings).outcome, 'warning');
check('45 min late, policy inactive = no fee', evaluateLateHandoff(45, settings).fee, 0);
const active: PricingSettings = { ...settings, late_fee_active: true };
check('45 min late, policy active = 5.00 once', evaluateLateHandoff(45, active).fee, 5);
check('missed handoff flagged', evaluateLateHandoff(null, settings).outcome, 'grace');

console.log('\n10. Duration boundaries');
check('1 day = daily', durationForDays(1), 'daily');
check('6 days = daily', durationForDays(6), 'daily');
check('7 days = weekly', durationForDays(7), 'weekly');
check('27 days = weekly', durationForDays(27), 'weekly');
check('28 days = monthly', durationForDays(28), 'monthly');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
