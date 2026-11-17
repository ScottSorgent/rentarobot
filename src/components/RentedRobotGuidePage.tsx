import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Map,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { Booking, Robot } from '@/lib/types';
import { getGuide } from '@/lib/robotGuides';

interface Props {
  robot: Robot;
  booking: Booking;
  onBack: () => void;
}

export default function RentedRobotGuidePage({ robot, booking, onBack }: Props) {
  const guide = getGuide(robot.slug, robot.name);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft size={18} /> Back to my rented robots
          </button>
          <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12">
        <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden">
          <div className="relative h-48 sm:h-60">
            <img src={robot.image_url} alt={robot.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{robot.name}</h1>
              <p className="mt-1 text-sm text-ink-200 flex flex-wrap items-center gap-2">
                <CalendarDays size={14} />
                {new Date(booking.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' → '}
                {new Date(booking.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                <span aria-hidden>·</span>
                {booking.plan_type === 'lease' ? 'Monthly rental' : 'Short-term rental'}
              </p>
            </div>
          </div>
        </div>

        <Section icon={<BookOpen size={18} />} title="Initial setup" subtitle="Do these in order before the first clean.">
          <ol className="space-y-3">
            {guide.setup.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-700 leading-relaxed">
                <span className="w-6 h-6 rounded-full bg-ink-950 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Section>

        <Section icon={<Map size={18} />} title="Mapping your space" subtitle="How to teach the robot the layout of each client site.">
          <ol className="space-y-3">
            {guide.mapping.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-700 leading-relaxed">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Section>

        <Section icon={<Sparkles size={18} />} title="Key features" subtitle="What this model can do on the job.">
          <ul className="grid sm:grid-cols-2 gap-3">
            {guide.features.map((feature, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-700 leading-relaxed bg-white border border-ink-100 rounded-xl p-3.5">
                <Sparkles size={15} className="text-brand-600 shrink-0 mt-0.5" />
                {feature}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Wrench size={18} />} title="Routine maintenance" subtitle="Keep it running like new on every client site.">
          <div className="space-y-3">
            {guide.maintenance.map((item, i) => (
              <div key={i} className="bg-white border border-ink-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                <p className="mt-1 text-sm text-ink-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<PlayCircle size={18} />} title="Hands-on training videos" subtitle="Watch the techniques before your first client visit.">
          <div className="space-y-3">
            {guide.videos.map((video) => (
              <a
                key={video.url}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white border border-ink-100 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all group"
              >
                <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <PlayCircle size={20} />
                </span>
                <span className="flex-1 text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">{video.title}</span>
                <ExternalLink size={15} className="text-ink-400 shrink-0" />
              </a>
            ))}
          </div>
        </Section>

        <Section icon={<AlertTriangle size={18} />} title="Warnings of use" subtitle="Read before every job — these keep you and clients safe.">
          <ul className="space-y-3">
            {guide.warnings.map((warning, i) => (
              <li key={i} className="flex gap-3 text-sm text-red-900 leading-relaxed bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                {warning}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<ShieldCheck size={18} />} title="Manufacturer's warranty" subtitle="What's covered on your rental.">
          <div className="bg-white border border-ink-100 rounded-xl divide-y divide-ink-100">
            <WarrantyRow label="Coverage" value={guide.warranty.coverage} />
            <WarrantyRow label="Duration" value={guide.warranty.duration} />
            <WarrantyRow label="Making a claim" value={guide.warranty.claims} />
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-ink-950 text-white flex items-center justify-center shrink-0">{icon}</span>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">{title}</h2>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function WarrantyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-sm text-ink-700 leading-relaxed">{value}</p>
    </div>
  );
}
