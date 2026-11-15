import { Bot, Home, LogOut, Menu, PackageCheck, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  userEmail: string;
  active: 'home' | 'browse';
  onHome: () => void;
  onBrowse: () => void;
  onBookings: () => void;
  onSignOut: () => void;
}

export default function AppHeader({ userEmail, active, onHome, onBrowse, onBookings, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
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
    { id: 'home' as const, label: 'Home', onClick: onHome, icon: Home },
    { id: 'browse' as const, label: 'Robotic Catalog', onClick: onBrowse, icon: Bot },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a
          href="#"
          className="flex items-center gap-2.5 shrink-0"
          onClick={(e) => {
            e.preventDefault();
            onHome();
            window.scrollTo({ top: 0 });
          }}
        >
          <img src="/Glossy_Robot_Calendar_App_Icon.png" alt="Rent-A-Robot logo" className="w-9 h-9 rounded-xl object-cover" />
          <span className="font-display font-bold text-xl tracking-tight">Rent-A-Robot</span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-brand-700 bg-brand-50 font-semibold'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                }`}
              >
                <item.icon size={15} /> {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onBookings}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition-colors"
          >
            <PackageCheck size={15} /> My bookings
          </button>
        </nav>

        <div className="hidden md:block" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="inline-flex items-center gap-2 bg-ink-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-800 transition-colors"
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
                <PackageCheck size={16} /> My bookings
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

        <button
          className="md:hidden p-2 rounded-lg hover:bg-ink-100 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-ink-100 bg-white px-4 py-3 flex flex-col gap-1 text-sm font-medium animate-fade-in">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setMenuOpen(false); item.onClick(); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                <item.icon size={16} /> {item.label}
              </button>
            );
          })}
          <button
            onClick={() => { setMenuOpen(false); onBookings(); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-ink-700 hover:bg-ink-50"
          >
            <PackageCheck size={16} /> My bookings
          </button>
          <button
            onClick={() => { setMenuOpen(false); onSignOut(); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
