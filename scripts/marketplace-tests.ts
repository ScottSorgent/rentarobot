// Marketplace logic tests: pure-function coverage of the rules the guarded
// database functions enforce (geo matching, payout split, overlap guard
// inputs, listing permission predicates). Run: npx tsx scripts/marketplace-tests.ts

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// --- Commission / payout split (mirrors create_booking_guarded) ---
function payoutSplit(total: number): { commission: number; payout: number } {
  const commission = Math.round(total * 0.20 * 100) / 100;
  const processing = Math.round(total * 0.029 * 100) / 100 + 0.3;
  const payout = Math.max(Math.round((total - commission - processing) * 100) / 100, 0);
  return { commission, payout };
}

const spec = payoutSplit(36.99);
check('commission on $36.99 is $7.40', spec.commission === 7.4);
check('payout on $36.99 subtracts commission and processing', spec.payout === 28.22);

const big = payoutSplit(1000);
check('commission on $1000 is $200', big.commission === 200);
check('payout on $1000 reflects processing fee', Math.abs(big.payout - (1000 - 200 - 29.3)) < 0.01);

const tiny = payoutSplit(1.0);
check('payout stays non-negative and below total', tiny.payout >= 0 && tiny.payout < 1.0);
check('payout floored at zero when fees exceed total', payoutSplit(0.5).payout >= 0);

// --- City matching: same city across all its ZIPs, no neighbor fallback ---
interface ZipCity { zip: string; city: string }
const zipCities: ZipCity[] = [
  { zip: '95201', city: 'stockton-ca' },
  { zip: '95202', city: 'stockton-ca' },
  { zip: '94588', city: 'pleasanton-ca' },
  { zip: '94588', city: 'dublin-ca' },
];
function citiesForZip(zip: string): string[] {
  return zipCities.filter((z) => z.zip === zip).map((z) => z.city);
}
check('Stockton ZIP resolves to Stockton', citiesForZip('95202').join(',') === 'stockton-ca');
check('ambiguous ZIP resolves to both cities', citiesForZip('94588').length === 2);
check('unknown ZIP resolves to nothing', citiesForZip('99999').length === 0);

function robotVisibleInCity(robotCity: string | null, isCurated: boolean, customerCity: string): boolean {
  return isCurated || robotCity === customerCity;
}
check('curated fleet visible in every city', robotVisibleInCity(null, true, 'los-angeles-ca'));
check('owner listing visible only in its own city', robotVisibleInCity('stockton-ca', false, 'stockton-ca'));
check('owner listing hidden from other cities', !robotVisibleInCity('stockton-ca', false, 'modesto-ca'));

// --- Overlap guard (mirrors the SQL date logic) ---
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
check('identical ranges conflict', overlaps('2026-01-01', '2026-01-31', '2026-01-15', '2026-02-15'));
check('back-to-back ranges do not conflict', !overlaps('2026-01-01', '2026-01-31', '2026-02-01', '2026-02-28'));
check('contained range conflicts', overlaps('2026-01-01', '2026-03-01', '2026-02-01', '2026-02-02'));

// --- Blackout intersection ---
interface Blackout { start: string; end: string }
function blackoutHit(blackouts: Blackout[], start: string, end: string): boolean {
  return blackouts.some((b) => b.start <= end && start <= b.end);
}
check('booking inside blackout blocked', blackoutHit([{ start: '2026-06-01', end: '2026-06-10' }], '2026-06-05', '2026-07-05'));
check('booking outside blackout allowed', !blackoutHit([{ start: '2026-06-01', end: '2026-06-10' }], '2026-06-11', '2026-07-11'));

// --- Listing permission predicates (mirror the SQL checks) ---
function canEdit(robotOwnerId: string, callerId: string | null): boolean {
  return callerId !== null && robotOwnerId === callerId;
}
check('owner can edit own listing', canEdit('u1', 'u1'));
check('stranger cannot edit listing', !canEdit('u1', 'u2'));
check('signed-out cannot edit', !canEdit('u1', null));

function canPublish(approvedAt: string | null): boolean {
  return approvedAt !== null;
}
check('unapproved listing cannot publish', !canPublish(null));
check('approved listing can publish', canPublish('2026-01-01T00:00:00Z'));

function editResubmitsToReview(status: string, next: string): string {
  return status === 'rejected' || status === 'changes_requested' ? 'pending_review' : next;
}
check('rejected listing returns to review after edit', editResubmitsToReview('rejected', 'published') === 'pending_review');
check('changes_requested returns to review after edit', editResubmitsToReview('changes_requested', 'paused') === 'pending_review');
check('published listing stays published after edit', editResubmitsToReview('published', 'published') === 'published');

// --- Refund state on cancellation ---
function refundState(startDate: string, today: string): string {
  return new Date(startDate).getTime() > new Date(today).getTime() + 2 * 86400000 ? 'refunded' : 'requested';
}
check('far-future cancellation is refunded', refundState('2026-12-01', '2026-06-01') === 'refunded');
check('last-minute cancellation requests refund', refundState('2026-06-03', '2026-06-01') === 'requested');

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
