import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export type Notification = {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export default function NotificationBell({
  userId, onOpen,
}: { userId: string; onOpen: (notification: Notification) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [list, unread] = await Promise.all([
      supabase.from('notifications')
        .select('id, type, title, body, data, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null),
    ])

    if (list.error || unread.error) {
      setError(list.error?.message ?? unread.error?.message ?? 'Could not load notifications.')
      return
    }

    setError('')
    setNotifications((list.data ?? []) as Notification[])
    setUnreadCount(unread.count ?? 0)
  }, [userId])

  useEffect(() => {
    const channel = supabase.channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => void load())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load()
      })

    return () => { void supabase.removeChannel(channel) }
  }, [load, userId])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('click', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  async function openNotification(notification: Notification) {
    if (!notification.read_at) {
      const { error: updateError } = await supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
        .eq('user_id', userId)
        .is('read_at', null)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      ))
      setUnreadCount((current) => Math.max(0, current - 1))
    }

    setOpen(false)
    onOpen(notification)
  }

  async function markAllRead() {
    const readAt = new Date().toISOString()
    const { error: updateError } = await supabase.from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', userId)
      .is('read_at', null)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })))
    setUnreadCount(0)
    setError('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((current) => !current); void load() }}
        title="Notifications"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="rentify-notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-reserved/50"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-booked px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="rentify-notifications"
          aria-label="Notifications"
          className="absolute right-0 top-full z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-ink/10"
        >
          <header className="flex items-center justify-between border-b border-ink/15 px-4 py-3">
            <h2 className="font-semibold text-ink">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-xs font-medium text-booked disabled:text-ink/40"
            >
              <CheckCheck size={15} /> Mark all read
            </button>
          </header>
          {error && <p role="alert" className="px-4 py-3 text-xs text-cleaning">{error}</p>}
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification)}
                className={`flex w-full gap-3 border-b border-ink/10 px-4 py-3 text-left hover:bg-cream ${
                  notification.read_at ? '' : 'bg-reserved/20'
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  notification.read_at ? 'bg-transparent' : 'bg-booked'
                }`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{notification.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink/70">{notification.body}</span>
                  <time className="mt-1 block text-[10px] text-ink/50">
                    {new Date(notification.created_at).toLocaleString('en-PH', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </time>
                </span>
              </button>
            ))}
            {!error && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ink/50">You’re all caught up.</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
