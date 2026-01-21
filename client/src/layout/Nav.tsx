import { NavLink } from 'react-router-dom'
import { Gamepad2, User, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
    { to: '/invite', label: 'Invite', icon: UserPlus },
    { to: '/', label: 'Game', icon: Gamepad2 },
    { to: '/profile', label: 'Profile', icon: User },
]

export default function Nav() {
    return (
        <div className="mx-auto flex h-[72px] max-w-md items-center justify-around border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                        cn(
                            'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                            isActive
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-primary'
                        )
                    }
                >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                </NavLink>
            ))}
        </div>
    )
}
