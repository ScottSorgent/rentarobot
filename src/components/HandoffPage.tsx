import { useState } from 'react';
import { BatteryCharging, CalendarClock, Camera, CheckCircle2, ClipboardCheck, MapPin, QrCode, TriangleAlert } from 'lucide-react';
import type { Booking, Robot } from '@/lib/types';
import { confirmHandoffSide, reportMaintenanceIssue, scheduleHandoff } from '@/lib/api';
import { formatMoney } from '@/lib/types';

interface Props {
  booking: Booking;
  robot: Robot;
  lateFeeAmount: number;
  lateFeeActive: boolean;
  onDone: () => void;
}

type HandoffStatus = string;

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function HandoffPage({ booking, robot, lateFeeAmount, lateFeeActive, onDone }: Props) {
  const status: HandoffStatus = booking.handoff_status ?? 'not_scheduled';
  const isOutgoing = status === 'scheduled' || status === 'cleaning_confirmed';
  const [pickupAt, setPickupAt] = useState('');
  const [location, setLocation] = useState('');
  const [code] = useState(() => generateCode());
  const [checklistDone, setChecklistDone] = useState(false);
  const [batteryConfirmed, setBatteryConfirmed] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [showIssue, setShowIssue] = useState(false);
  const [issueType, setIssueType] = useState<'battery' | 'brushes' | 'filter' | 'sensor' | 'other'>('other');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<'minor' | 'major' | 'unsafe'>('minor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bothConfirmed = Boolean(booking.outgoing_confirmed_at && booking.incoming_confirmed_at);

  async function handleSchedule() {
    if (!pickupAt || !location.trim()) {
      setError('Choose a pickup date and time and confirm the meeting location.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await scheduleHandoff({ bookingId: booking.id, pickupAt, handoffLocation: location.trim(), handoffCode: code });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule the handoff.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(side: 'outgoing' | 'incoming') {
    setBusy(true);
    setError(null);
    try {
      await confirmHandoffSide(booking.id, side, { checklistDone, batteryConfirmed, photoCount });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the confirmation.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReportIssue() {
    if (!issueDescription.trim()) {
      setError('Describe the problem before submitting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportMaintenanceIssue({
        equipmentRecordId: null,
        bookingId: booking.id,
        issueType,
        description: issueDescription.trim(),
        severity: issueSeverity,
      });
      setShowIssue(false);
      setIssueDescription('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <CalendarClock size={20} className="text-brand-700" /> Handoff — {robot.name}
          </h1>
          <p className="text-sm text-ink-500 mt-1.5">
            Rental {booking.start_date} to {booking.end_date} · {formatMoney(booking.total_price)}.
            Status: <span className="font-semibold text-ink-800">{status.replace(/_/g, ' ')}</span>
            {bothConfirmed && ' — both parties confirmed.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {status === 'not_scheduled' && (
          <section className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-4">
            <h2 className="font-display font-semibold flex items-center gap-2"><MapPin size={18} className="text-brand-700" /> Schedule the pickup</h2>
            <p className="text-sm text-ink-500">
              Agree a time with the next renter in the app first. The exact address is only shared after both of you confirm the arrangement.
            </p>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Pickup date & time</span>
              <input type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Meeting location (area only until confirmed)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Rainier AveS McDonald's parking lot" className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <button onClick={handleSchedule} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
              <CalendarClock size={17} /> {busy ? 'Scheduling...' : 'Schedule handoff'}
            </button>
          </section>
        )}

        {isOutgoing && (
          <section className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-4">
            <h2 className="font-display font-semibold flex items-center gap-2"><ClipboardCheck size={18} className="text-brand-700" /> Before the handoff</h2>
            <ul className="text-sm text-ink-600 space-y-1.5">
              <li>1. Empty and wipe down the dustbin, brushes and mop pads.</li>
              <li>2. Charge the battery fully the night before.</li>
              <li>3. Take dated photos of the robot from every side.</li>
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checklistDone} onChange={(e) => setChecklistDone(e.target.checked)} className="w-4 h-4 accent-brand-600" />
              Cleaning checklist complete <ClipboardCheck size={14} className="text-ink-400" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={batteryConfirmed} onChange={(e) => setBatteryConfirmed(e.target.checked)} className="w-4 h-4 accent-brand-600" />
              Battery fully charged <BatteryCharging size={14} className="text-ink-400" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1.5 block">Condition photos taken</span>
              <input type="number" min={0} value={photoCount} onChange={(e) => setPhotoCount(Math.max(0, Number(e.target.value)))} className="w-32 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <Camera size={14} className="inline ml-1.5 text-ink-400" />
            </label>
            <div className="rounded-xl bg-ink-50 border border-ink-100 p-4 flex items-center gap-3">
              <QrCode size={28} className="text-ink-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-ink-600">Your handoff code</p>
                <p className="font-display text-lg font-bold tracking-widest">{booking.handoff_code ?? code}</p>
                <p className="text-xs text-ink-400">Show this to the incoming renter to confirm the transfer.</p>
              </div>
            </div>
            <button onClick={() => handleConfirm('outgoing')} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
              <CheckCircle2 size={17} /> {busy ? 'Recording...' : 'I am ready to hand off'}
            </button>
          </section>
        )}

        {(status === 'scheduled' || status === 'cleaning_confirmed' || status === 'in_progress') && !isOutgoing && (
          <section className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-4">
            <h2 className="font-display font-semibold flex items-center gap-2"><CheckCircle2 size={18} className="text-brand-700" /> Inspect before accepting</h2>
            <p className="text-sm text-ink-500">
              Check the robot against the outgoing renter's photos, confirm the battery is charged, and verify the handoff code matches. Ask about anything that looks off before you accept custody.
            </p>
            <button onClick={() => handleConfirm('incoming')} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
              <CheckCircle2 size={17} /> {busy ? 'Recording...' : 'Inspect & accept the robot'}
            </button>
          </section>
        )}

        {lateFeeActive && status === 'in_progress' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs">
            Late-handoff policy: over {lateFeeAmount > 0 ? `${formatMoney(lateFeeAmount)} applies after 30 minutes` : 'manual review after 30 minutes'}. One charge per incident; disputes and waivers are handled by support.
          </div>
        )}

        <section className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-3">
          <button onClick={() => setShowIssue((v) => !v)} className="text-sm font-semibold text-brand-700 hover:text-brand-600 inline-flex items-center gap-2">
            <TriangleAlert size={16} /> Report a maintenance issue
          </button>
          {showIssue && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1 block">Problem</span>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value as typeof issueType)} className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="battery">Battery</option>
                    <option value="brushes">Brushes</option>
                    <option value="filter">Filter</option>
                    <option value="sensor">Sensors</option>
                    <option value="other">Something else</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-600 mb-1 block">Severity</span>
                  <select value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value as typeof issueSeverity)} className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="minor">Minor — still usable</option>
                    <option value="major">Major — needs service</option>
                    <option value="unsafe">Unsafe — do not use</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-ink-600 mb-1 block">What happened?</span>
                <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} rows={3} className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </label>
              <button onClick={handleReportIssue} disabled={busy} className="inline-flex items-center justify-center gap-2 bg-ink-950 hover:bg-ink-800 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
                {busy ? 'Submitting...' : 'Submit report'}
              </button>
              <p className="text-xs text-ink-400">Normal wear and tear is never charged to renters. Unsafe units are blocked from the next handoff automatically.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
