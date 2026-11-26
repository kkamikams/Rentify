import { MessageCircle, User } from 'lucide-react'
import NotificationBell from './NotificationBell'
import type { Notification } from './NotificationBell'

export default function CustomerHeader({
  name, activeAccountPage, userId, onNotificationOpen,
  onHome, onMessages, onProfile, onBookings,
}: {
  name?: string
  activeAccountPage?: 'messages' | 'profile' | 'bookings'
  userId?: string
  onNotificationOpen?: (notification: Notification) => void
  onHome: () => void
  onMessages: () => void
  onProfile: () => void
  onBookings: () => void
}) {
  return (
    <header className="bg-cream shadow-[0_2px_3px_rgba(63,49,43,0.25)]">
      <div className="mx-auto flex max-w-10xl items-center px-6 py-4">
      <button onClick={onHome} aria-label="Rentify home" className="text-2xl font-semibold">
        Rentify.
      </button>
      <nav className="ml-20 hidden items-center gap-20 text-sm font-medium md:flex">
        <button type="button">FAQ</button>
        <button type="button">How It Works</button>
        <button type="button" onClick={onBookings}>Book A Fitting</button>
      </nav>
        <div className="ml-auto flex items-center gap-5">          {name && <span className="hidden text-sm sm:inline">{name}</span>}
          {userId && onNotificationOpen && <NotificationBell userId={userId} onOpen={onNotificationOpen} />}
          <button onClick={onMessages} title="Messages" aria-label="Messages"><MessageCircle size={20} fill="currentColor" /></button>
          <button onClick={onProfile} title="My profile" aria-label="My profile"
            aria-current={activeAccountPage === 'profile' ? 'page' : undefined}
            className={activeAccountPage === 'profile' ? 'text-booked' : undefined}>
            <User size={20} fill="currentColor" />
          </button>
          <button
            onClick={onBookings}
            title="My bookings"
            aria-label="My bookings"
            aria-current={activeAccountPage === 'bookings' ? 'page' : undefined}
            className={`-ml-1.5 flex items-center justify-center ${activeAccountPage === 'bookings' ? 'opacity-70' : ''}`}
          >
            <img src="/bookings.png" alt="My bookings" className="block h-8 w-8 object-contain" />
          </button>
        </div>
      </div>
    </header>
  )
}
