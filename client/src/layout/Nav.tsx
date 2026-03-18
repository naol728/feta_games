import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/invite', label: 'Invite', emoji: '👥' },
  { to: '/', label: 'Game', emoji: '🏆' },
  { to: '/profile', label: 'Profile', emoji: '👤' },
]

export default function Nav() {
  return (
    <div className="fixed bottom-3 left-0 right-0 flex justify-center z-50">
      <div className="flex w-[92%] max-w-md items-center justify-between px-6 py-2 rounded-2xl bg-card/80 backdrop-blur border border-border shadow-lg">

        {items.map(({ to, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 text-[10px] transition-all',
                isActive
                  ? 'text-primary scale-110'
                  : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full transition-all',
                    isActive
                      ? 'w-11 h-11 bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)),0_0_40px_hsl(var(--primary))]'
                      : 'w-9 h-9'
                  )}
                >
                  <span
                    className={cn(
                      'text-xl transition-all',
                      isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary))]'
                    )}
                  >
                    {emoji}
                  </span>
                </div>

                <span className={cn(isActive && 'font-semibold')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}