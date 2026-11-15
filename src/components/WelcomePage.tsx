import { ArrowRight, Bot, CalendarCheck, Lock, Mail, Search, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';

type Mode = 'welcome' | 'signin' | 'signup' | 'reset';

interface Props {
  onAuthed: () => void;
}

const features = [
  {
    icon: Bot,
    title: 'Work Smarter on Every Clean',
    text: 'Premium floor, glass and edge-cleaning robots that help independent housecleaners deliver a deeper finish.',
  },
  {
    icon: Search,
    title: 'Choose Your Cleaning Setup',
    text: 'Compare high-suction vacuums, window cleaners and corner-detail tools by coverage, runtime, ratings and service city.'
  },
  {
    icon: CalendarCheck,
    title: 'Rent Short-Term or Lease',
    text: 'Book a quick rental for a busy week or choose a monthly lease for a dependable everyday partner.'
  },
];

function Logo({ size = 'lg' }: { size?: 'lg' | 'sm' | 'xl' }) {
  const box =
    size === 'xl'
      ? 'w-24 h-24 sm:w-28 sm:h-28 rounded-3xl'
      : size === 'lg'
        ? 'w-20 h-20 rounded-3xl'
        : 'w-12 h-12 rounded-2xl';
  return (
    <div className={`${box} overflow-hidden shadow-lg shadow-black/30`}>
      <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="" className="w-full h-full object-cover" />
    </div>
  );
}

function AuthInput({
  icon: Icon,
  ...props
}: {
  icon: typeof Mail;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600 mb-1.5 block">{props.name && labelFor(props.name)}</span>
      <span className="relative block">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          {...props}
          className="w-full bg-white border border-ink-200 rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </span>
    </label>
  );
}

function labelFor(name: string): string {
  switch (name) {
    case 'email':
      return 'Email';
    case 'password':
      return 'Password';
    case 'fullName':
      return 'Full name';
    default:
      return name;
  }
}

export default function WelcomePage({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('welcome');

  return (
    <div className="min-h-screen bg-ink-950 relative overflow-hidden">
      <img
        src="/premium-deep-clean-floor-robot.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/90 to-ink-950" />

      <div className="relative min-h-screen flex flex-col">
        <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <span className="font-display font-bold text-3xl text-white tracking-tight">Rent-A-Robot</span>
          </div>
          {mode !== 'welcome' ? (
            <button
              onClick={() => setMode('welcome')}
              className="text-sm font-semibold text-ink-300 hover:text-white transition-colors"
            >
              Back
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode('signin')}
                className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => setMode('signup')}
                className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-ink-950 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Create New Account <ArrowRight size={16} />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-16">
          {mode === 'welcome' ? (
            <WelcomePane onSignIn={() => setMode('signin')} onSignUp={() => setMode('signup')} />
          ) : (
            <AuthPane mode={mode} setMode={setMode} onAuthed={onAuthed} />
          )}
        </main>

        <footer className="max-w-6xl w-full mx-auto px-4 sm:px-6 pb-8">
          <p className="text-xs text-ink-400">
            © 2026 Rent-A-Robot Inc. Pickup-only rentals — reserve online, collect in store.
          </p>
        </footer>
      </div>
    </div>
  );
}

function WelcomePane({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <>
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.15]">
          Your Cleaning Business, Upgraded
        </h1>
        <p className="mt-3 text-sm text-ink-300 leading-relaxed max-w-2xl">
          Lease or rent professional cleaning robots that help you finish more homes, protect your energy and grow on your terms.
        </p>
      </div>

      <div className="mt-5 grid sm:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '120ms' }}>
        {features.map((f, i) => (
          <div
            key={f.title}
            style={{ animationDelay: `${120 + i * 80}ms` }}
            className="animate-fade-up bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-400/20 flex items-center justify-center shrink-0">
                <f.icon size={20} className="text-brand-300" />
              </span>
              <h3 className="font-display font-semibold text-white">{f.title}</h3>
            </div>
            <p className="mt-1.5 text-sm text-ink-300 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        <p className="text-sm text-ink-400">
          Forgot your password?{' '}
          <button onClick={onSignIn} className="text-brand-300 font-semibold hover:text-brand-200 transition-colors">
            Reset it here
          </button>
        </p>
      </div>
    </>
  );
}

function AuthPane({
  mode,
  setMode,
  onAuthed,
}: {
  mode: 'signin' | 'signup' | 'reset';
  setMode: (m: Mode) => void;
  onAuthed: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { signIn, signUp, resetPassword } = await import('@/lib/auth');
      if (mode === 'signin') {
        await signIn(email, password);
        onAuthed();
      } else if (mode === 'signup') {
        await signUp(email, password, fullName);
        onAuthed();
      } else {
        await resetPassword(email);
        setNotice("Check your inbox — we sent a link to reset your password.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<typeof mode, { heading: string; sub: string; action: string }> = {
    signin: { heading: 'Welcome back', sub: 'Sign in to view your bookings and rent robots.', action: 'Sign in' },
    signup: { heading: 'Create your account', sub: 'Join to book robots and manage your rentals.', action: 'Create New Account' },
    reset: { heading: 'Reset password', sub: 'Enter your email and we will send you a reset link.', action: 'Send reset link' },
  };
  const t = titles[mode];

  return (
    <div className="w-full max-w-md mx-auto my-12 animate-fade-up">
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <h2 className="font-display text-2xl font-bold tracking-tight">{t.heading}</h2>
        <p className="mt-1.5 text-sm text-ink-500">{t.sub}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <AuthInput
              icon={User}
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Rivera"
              autoComplete="name"
              required
            />
          )}
          <AuthInput
            icon={Mail}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {mode !== 'reset' && (
            <AuthInput
              icon={Lock}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}
          {notice && (
            <div className="bg-brand-50 border border-brand-200 text-brand-900 rounded-xl px-4 py-3 text-sm">{notice}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3.5 rounded-xl transition-colors"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Working...
              </>
            ) : (
              t.action
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-ink-100 space-y-2 text-sm text-center">
          {mode === 'signin' && (
            <>
              <p className="text-ink-500">
                New here?{' '}
                <button onClick={() => setMode('signup')} className="font-semibold text-brand-700 hover:text-brand-600">
                  Create an account
                </button>
              </p>
              <p className="text-ink-500">
                <button onClick={() => setMode('reset')} className="font-semibold text-brand-700 hover:text-brand-600">
                  Reset password
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-ink-500">
              Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="font-semibold text-brand-700 hover:text-brand-600">
                Sign in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p className="text-ink-500">
              Remembered it?{' '}
              <button onClick={() => setMode('signin')} className="font-semibold text-brand-700 hover:text-brand-600">
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-400 flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} /> Your account secures every booking you make.
      </p>
    </div>
  );
}
