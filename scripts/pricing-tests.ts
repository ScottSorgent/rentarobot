import {
  DEFAULT_SETTINGS,
  evaluateLateHandoff,
  quoteListing,
  quoteRenterMonthly,
  round2,
  scenarioUtilization,
  splitMonthlyPayment,
  utilizationTable,
} from '../src/lib/pricing';
import { monthsBetween, quoteTotal } from '../src/lib/types';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

const S = { ...DEFAULT_SETTINGS };

// --- Renter quote: list + flat service fee + tax ---
{
  const q = quoteRenterMonthly(500, S, 1);
  check('renter 1mo list = 500', q.listPrice === 500);
  check('renter 1mo fee = 25', q.serviceFee === 25);
  check('renter 1mo tax = 0', q.tax === 0);
  check('renter 1mo total = 525', q.total === 525);
}
{
  const q = quoteRenterMonthly(500, S, 3);
  check('renter 3mo list = 1500', q.listPrice === 1500);
  check('renter 3mo fee = 75', q.serviceFee === 75);
  check('renter 3mo total = 1575', q.total === 1575);
}
{
  const withTax = { ...S, tax_rate: 0.08 };
  const q = quoteRenterMonthly(1000, withTax, 1);
  check('tax applied on list+fee', q.tax === round2((1000 + 25) * 0.08) && q.total === round2(1025 + q.tax));
}
check('negative price clamped', quoteRenterMonthly(-50, S).listPrice === 0);

// --- Marketplace split: commission + fee - processing ---
{
  const sp = splitMonthlyPayment(500, S, 1);
  const proc = round2(525 * 0.029 + 0.3);
  check('commission = 15% of list', sp.commission === 75);
  check('platform earnings = commission + fee - processing', sp.platformEarnings === round2(75 + 25 - proc));
  check('owner payout = list - commission - processing share', sp.ownerPayout === round2(500 - 75 - proc));
  check('gross payment = renter total', sp.grossPayment === 525);
}
{
  const zero = splitMonthlyPayment(0, S, 1);
  check('zero list still keeps service fee', zero.platformEarnings === round2(25 - round2(25 * 0.029 + 0.3)));
  check('zero list pays owner nothing', zero.ownerPayout === 0);
}

// --- Listing economics at utilization ---
{
  const q = quoteListing({ owner_monthly_price: 500 }, S, 0.8);
  check('u80 books 9.6 months/yr', q.monthsBooked === 9.6);
  const sp = splitMonthlyPayment(500, S, 9.6);
  check('u80 platform earnings match split', q.platformEarnings === sp.platformEarnings);
  check('u80 owner earnings match split', round2(q.ownerEarnings) === round2(sp.ownerPayout));
}
check('u100 books 12 months', quoteListing({ owner_monthly_price: 500 }, S, 1).monthsBooked === 12);
check('u60 books 7.2 months', quoteListing({ owner_monthly_price: 500 }, S, 0.6).monthsBooked === 7.2);
check('utilization clamped to [0,1]', quoteListing({ owner_monthly_price: 500 }, S, 2).monthsBooked === 12);

// --- Utilization table: 5 rows, monotonic in utilization ---
{
  const rows = utilizationTable({ owner_monthly_price: 500 }, S);
  check('table has 5 rows', rows.length === 5);
  check('rows monotonic renter total', rows.every((r, i) => i === 0 || r.renterTotal >= rows[i - 1].renterTotal));
  check('rows monotonic platform earnings', rows.every((r, i) => i === 0 || r.platformEarnings >= rows[i - 1].platformEarnings));
  check('first row 60%', rows[0].utilization === 0.6);
  check('last row 100%', rows[4].utilization === 1.0);
}

// --- Scenario mapping ---
check('scenario u70 reads u70 setting', scenarioUtilization({ ...S, u70: 0.71 }, 0.7) === 0.71);
check('scenario fallback to level when 0', scenarioUtilization({ ...S, u80: 0 }, 0.8) === 0.8);

// --- Months between (lease length) ---
check('1 month lease', monthsBetween('2026-01-01', '2026-02-01') === 1);
check('3 month lease', monthsBetween('2026-01-01', '2026-04-01') === 3);
check('single day floors to 1 month', monthsBetween('2026-01-01', '2026-01-01') === 1);
check('45 days rounds up to 2 months', monthsBetween('2026-01-01', '2026-02-14') === 2);

// --- Catalog quoteTotal ---
const robot = { monthly_rate: 499 } as never as Parameters<typeof quoteTotal>[0];
check('quoteTotal 1 month', quoteTotal(robot, 1) === 499);
check('quoteTotal 6 months', quoteTotal(robot, 6) === 2994);
check('quoteTotal floors to 1 month', quoteTotal(robot, 0) === 499);

// --- Late handoff policy (unchanged behavior) ---
check('grace: no fee', evaluateLateHandoff(10, S).fee === 0);
check('warning zone: no fee', evaluateLateHandoff(20, S).outcome === 'warning' && evaluateLateHandoff(20, S).fee === 0);
check('late while inactive: no charge', evaluateLateHandoff(45, S).fee === 0);
check('late while active: one flat fee', evaluateLateHandoff(45, { ...S, late_fee_active: true }).fee === 5);
check('grace edge exactly at limit', evaluateLateHandoff(15, S).outcome === 'grace');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
