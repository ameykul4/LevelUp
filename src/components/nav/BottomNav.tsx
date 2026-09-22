import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', emoji: '🏠' },
  { to: '/diary', label: 'Diary', emoji: '📔' },
  { to: '/photos', label: 'Photos', emoji: '📸' },
  { to: '/reports', label: 'Reports', emoji: '📊' },
  { to: '/settings', label: 'Settings', emoji: '⚙️' },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 bg-surface border-t border-ink-soft/10 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs ${isActive ? 'text-you' : 'text-ink-soft'}`
          }
        >
          <span className="text-lg leading-none">{item.emoji}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
