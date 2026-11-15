import { CalendarCheck, Home, UserRound, Wrench } from 'lucide-react';
import { Bot } from 'lucide-react';

export type MobileTab = 'home' | 'browse' | 'bookings' | 'rented' | 'profile';

interface Props {
  active: MobileTab;
  onNavigate: (tab: MobileTab) => void;
}

const tabs: { id: MobileTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'browse', label: 'Robots', icon: Bot },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { id: 'rented', label: 'Rented', icon: Wrench },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export default function MobileNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-ink-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-brand-700' : 'text-ink-400 hover:text-ink-700'
              }`}
            >
              <span className={`w-9 h-7 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-brand-100' : ''}`}>
                <Icon size={20} />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
