import { Bot, Home, LogOut, PackageCheck, PlusCircle, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  userEmail: string;
  active: 'home' | 'browse' | 'list' | 'bookings';
  onHome: () => void;
  onBrowse: () => void;
  onList: () => void;
  onBookings: () => void;
  onSignOut: () => void;
}

export default function AppHeader({ userEmail, active, onHome, onBrowse, onList, onBookings, onSignOut }: Props) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const navItems = [
    {
      id: 'home' as const,
      label: 'Home',
      onClick: onHome,
      icon: Home,
      idle: 'bg-white text-ink-500 border-ink-200 hover:bg-ink-50 hover:text-ink-800',
    },
    {
      id: 'browse' as const,
      label: 'Robotic Catalog',
      onClick: onBrowse,
      icon: Bot,
      idle: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:text-rose-900',
    },
    {
      id: 'list' as const,
      label: 'List Your Robot',
      onClick: onList,
      icon: PlusCircle,
      idle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-900',
    },
  ];

  // Shared emphasis for the current page: a solid dark fill with white text,
  // so the selected tab reads clearly without a stroke outline.
  const activeClasses = 'bg-ink-900 text-white border-ink-900 font-semibold';

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <a
          href="#"
          className="hidden md:flex items-center gap-2.5 shrink-0"
          onClick={(e) => {
            e.preventDefault();
            onHome();
            window.scrollTo({ top: 0 });
          }}
        >
          <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-12 h-12 rounded-xl object-cover" />
          <span className="font-display font-bold text-xl tracking-tight">Rent-A-Robot</span>
        </a>

        <nav className="hidden md:flex items-center justify-center gap-2 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  isActive ? activeClasses : item.idle
                }`}
              >
                <item.icon size={15} /> {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onBookings}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              active === 'bookings'
                ? activeClasses
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-900'
            }`
            }
          >
            <PackageCheck size={15} /> My Bookings
          </button>
        </nav>

        <div className="flex justify-end items-center gap-2" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-2 bg-ink-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-800 transition-colors"
          >
            <User size={16} /> Account
          </button>
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="hidden md:inline-flex items-center gap-2 bg-ink-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-800 transition-colors"
          >
            <User size={16} /> Account
          </button>
          {accountOpen && (
            <div className="absolute right-4 sm:right-6 mt-2 w-64 bg-white rounded-2xl border border-ink-100 shadow-xl p-2 animate-fade-in z-40">
              <div className="px-3 py-2.5 border-b border-ink-100">
                <p className="text-xs text-ink-400">Signed in as</p>
                <p className="text-sm font-semibold text-ink-900 truncate">{userEmail}</p>
              </div>
              <button
                onClick={() => { setAccountOpen(false); onBookings(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
              >
                <PackageCheck size={16} /> My Bookings
              </button>
              <button
                onClick={() => { setAccountOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
