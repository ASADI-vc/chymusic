import { Outlet, NavLink } from 'react-router-dom';
import { Home, Search, Library, Settings } from 'lucide-react';
import { PlayerBar } from './PlayerBar';
import './AppLayout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Your Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__logo">CHY</span>
          <span className="app-shell__brandname">CHYMUSIC</span>
        </div>
        <nav className="app-shell__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? 'app-shell__nav-item--active' : ''}`
              }
            >
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-shell__sidebar-footer">
          <p className="app-shell__hint">
            Cached locally · Offline-ready
          </p>
        </div>
      </aside>
      <main className="app-shell__main">
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  );
}
