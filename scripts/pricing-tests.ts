import {
  DEFAULT_SETTINGS,
  evaluateLateHandoff,
  quoteListingMonthly,
  quoteRental,
  rateForDuration,
  round2,
  scenarioUtilization,
  splitPayment,
  utilizationTable,
} from '../src/lib/pricing';
import { isHumanoid, monthsBetween, weeksBetween } from '../src/lib/types';

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
check('commission default is 20%', S.commission_pct === 0.2);
check('hosting allocation default is $1', S.hosting_monthly === 1);

// --- Rate resolution: owners' defined rates used as-is, never cross-multiplied ---
const humanoidRates = { monthly: 4790, daily: 289, weekly: 1549 };
check('daily rate from owner field', rateForDuration(humanoidRates, 'daily') === 289);
check('weekly rate from owner field', rateForDuration(humanoidRates, 'weekly') === 1549);
check('monthly rate from owner field', rateForDuration(humanoidRates, 'monthly') === 4790);
check('daily NOT daily*1 derived from monthly', rateForDuration(humanoidRates, 'daily') !== round2(4790 / 30));
const monthlyOnly = { monthly: 79, daily: null, weekly: null };
check('non-humanoid has no daily rate', rateForDuration(monthlyOnly, 'daily') === null);
check('non-humanoid monthly available', rateForDuration(monthlyOnly, 'monthly') === 79);

// --- Renter quote: owner price only, no platform service fee added ---
{
  const q = quoteRental({ monthly: 36.99, daily: null, weekly: null }, 'monthly', 1, S);
  check('reference vacuum subtotal = $36.99', q.subtotal === 36.99);
  check('no service fee added', q.total === 36.99);
  check('unit price preserved with cents', q.unitPrice === 36.99);
}
{
  const q = quoteRental({ monthly: 79, daily: null, weekly: null }, 'monthly', 3, S);
  check('3 months of $79 = $237', q.subtotal === 237);
}
{
  const withTax = { ...S, tax_rate: 0.08 };
  const q = quoteRental({ monthly: 36.99, daily: null, weekly: null }, 'monthly', 1, withTax);
  check('tax applied on subtotal', q.tax === round2(36.99 * 0.08) && q.total === round2(36.99 + q.tax));
}
{
  const d = quoteRental(humanoidRates, 'daily', 5, S);
  check('5 humanoid days = 5 x $289', d.subtotal === 1445);
  const w = quoteRental(humanoidRates, 'weekly', 2, S);
  check('2 humanoid weeks = 2 x $1,549', w.subtotal === 3098);
}
check('daily not monthly*30', quoteRental(humanoidRates, 'daily', 30, S).subtotal !== 4790);

// --- Marketplace split: 20% commission / 80% owner, commission never added on ---
{
  const sp = splitPayment(36.99, S, 'monthly');
  const proc = round2(36.99 * 0.029 + 0.3);
  check('20% commission of $36.99 = $7.40', sp.commission === 7.4);
  check('owner payout = 80% minus processing share', sp.ownerPayout === round2(36.99 - 7.4 - proc));
  check('platform earnings = commission only', sp.platformEarnings === sp.commission);
  check('gross equals renter payment (nothing added)', sp.grossPayment === 36.99);
  check('marketing = 20% of commission', sp.marketingExpense === round2(7.4 * 0.2));
  check('hosting $1 on monthly rental', sp.hostingAllocation === 1);
}
{
  const d = splitPayment(289, S, 'daily');
  check('daily commission = 20% of $289', d.commission === 57.8);
  check('daily owner payout', d.ownerPayout === round2(289 - 57.8 - round2(289 * 0.029 + 0.3)));
  check('no hosting allocation on daily rental', d.hostingAllocation === 0);
}
{
  const w = splitPayment(1549, S, 'weekly');
  check('weekly commission = 20% of $1,549', w.commission === 309.8);
  check('no hosting allocation on weekly rental', w.hostingAllocation === 0);
}
check('zero payment yields zero commission', splitPayment(0, S, 'monthly').commission === 0);

// --- Listing economics at utilization ---
{
  const q = quoteListingMonthly(36.99, S, 0.8);
  check('u80 books 9.6 months/yr', q.transactionsPerYear === 9.6);
  check('u80 renter total = 9.6 x $36.99 (fractional months kept)', q.renterTotal === round2(9.6 * 36.99));
  check('u80 commission = 20%', q.commission === round2(q.renterTotal * 0.2));
  check('u80 owner earnings = 80% minus processing', q.ownerEarnings === round2(q.renterTotal - q.commission - round2(q.renterTotal * 0.029 + 0.3)));
}
check('u100 books 12 months', quoteListingMonthly(79, S, 1).transactionsPerYear === 12);

// --- Utilization table: 5 rows, monotonic ---
{
  const rows = utilizationTable(36.99, S);
  check('table has 5 rows', rows.length === 5);
  check('rows monotonic renter total', rows.every((r, i) => i === 0 || r.renterTotal >= rows[i - 1].renterTotal));
  check('rows monotonic platform earnings', rows.every((r, i) => i === 0 || r.platformEarnings >= rows[i - 1].platformEarnings));
  check('first row 60%', rows[0].utilization === 0.6);
  check('last row 100%', rows[4].utilization === 1.0);
}

// --- Scenario mapping ---
check('scenario u70 reads u70 setting', scenarioUtilization({ ...S, u70: 0.71 }, 0.7) === 0.71);
check('scenario fallback to level when 0', scenarioUtilization({ ...S, u80: 0 }, 0.8) === 0.8);

// --- Booking span math ---
check('1 month lease', monthsBetween('2026-01-01', '2026-02-01') === 1);
check('3 month lease', monthsBetween('2026-01-01', '2026-04-01') === 3);
check('single day floors to 1 month', monthsBetween('2026-01-01', '2026-01-01') === 1);
check('1 week', weeksBetween('2026-01-01', '2026-01-07') === 1);
check('8 days rounds to 2 weeks', weeksBetween('2026-01-01', '2026-01-08') === 2);

// --- Humanoid detection ---
check('humanoid robot detected', isHumanoid({ daily_rate: 289, weekly_rate: 1549 } as never));
check('non-humanoid detected', !isHumanoid({ daily_rate: null, weekly_rate: null } as never));

// --- Late handoff policy (unchanged behavior) ---
check('grace: no fee', evaluateLateHandoff(10, S).fee === 0);
check('warning zone: no fee', evaluateLateHandoff(20, S).outcome === 'warning' && evaluateLateHandoff(20, S).fee === 0);
check('late while inactive: no charge', evaluateLateHandoff(45, S).fee === 0);
check('late while active: one flat fee', evaluateLateHandoff(45, { ...S, late_fee_active: true }).fee === 5);
check('grace edge exactly at limit', evaluateLateHandoff(15, S).outcome === 'grace');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
