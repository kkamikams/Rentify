import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigation } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { isValidName, digitsOnly, isValidPhone } from '../../lib/name'

type Meta = { full_name?: string; phone?: string; addresses?: string[] }
type Tab = 'profile' | 'bookings'

const smallBtn = 'rounded-sm border border-ink/15 bg-white px-4 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
const field = 'w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm'

// Left menu (Profile / My bookings) shared by both account pages
export function AccountLayout({ tab, onTab, children }: { tab: Tab; onTab: (t: Tab) => void; children: ReactNode }) {
  const item = (t: Tab, label: string) => (
    <button onClick={() => onTab(t)}
      className={`block w-fit border-b-2 pb-0.5 text-sm font-semibold ${tab === t ? 'border-ink' : 'border-transparent'}`}>
      {label}
    </button>
  )
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 md:grid-cols-[140px_1fr]">
      <nav className="space-y-3">{item('profile', 'Profile')}{item('bookings', 'My bookings')}</nav>
      <div>{children}</div>
    </div>
  )
}

export default function ProfilePage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const meta = session.user.user_metadata as Meta
  const addresses = meta.addresses ?? []

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(meta.full_name ?? '')
  const [phone, setPhone] = useState(meta.phone ?? '')
  const [adding, setAdding] = useState(false)
  const [addr, setAddr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Saves into the account itself (no extra table needed)
  async function save(data: Meta) {
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.updateUser({ data })
    setBusy(false)
    if (error) { setErr(error.message); return false }
    return true
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!isValidName(name)) {
      setErr('Full name must contain letters and cannot contain numbers.')
      return
    }
    if (!isValidPhone(phone)) {
      setErr('Enter your mobile number using 10 to 15 digits.')
      return
    }
    if (await save({ full_name: name.trim(), phone: phone.trim() })) setEditing(false)
  }
  async function addAddress(e: FormEvent) {
    e.preventDefault()
    if (!addr.trim()) return
    if (await save({ addresses: [...addresses, addr.trim()] })) { setAddr(''); setAdding(false) }
  }

  async function setPrimaryAddress(index: number) {
    if (index === 0) return
    const reordered = [addresses[index], ...addresses.filter((_, i) => i !== index)]
    await save({ addresses: reordered })
  }

  return (
    <section className="rounded-sm bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{meta.full_name || 'Your profile'}</h2>
          <p className="mt-1 text-sm text-ink/60">Manage your contact details and pickup addresses.</p>
        </div>
        {!editing && <button className={smallBtn} onClick={() => setEditing(true)}>Edit contact</button>}
      </div>

      {editing && (
        <form onSubmit={saveProfile} className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink/70">
            Full name
            <input required className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value.replace(/[\p{N}\d]/gu, ''))} />
          </label>
          <label className="text-sm text-ink/70">
            Mobile number
            <input type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" required className={`${field} mt-1`} placeholder="Mobile number" value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
          </label>
          <div className="flex gap-2">
            <button className={smallBtn} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" className={smallBtn} onClick={() => { setEditing(false); setName(meta.full_name ?? ''); setPhone(meta.phone ?? '') }}>Cancel</button>
          </div>
        </form>
      )}

      {!editing && (
        <dl className="grid gap-4 rounded-sm bg-cream p-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink/60">Email</dt>
            <dd className="break-all font-semibold">{session.user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink/60">Mobile number</dt>
            <dd className="font-semibold">{meta.phone || 'Not added'}</dd>
          </div>
        </dl>
      )}

      <div className="mb-3 mt-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Pickup addresses</h2>
          <p className="mt-1 text-sm text-ink/60">Choose a primary address and keep other addresses for later.</p>
        </div>
        {!adding && <button className={smallBtn} onClick={() => setAdding(true)}>Add address</button>}
      </div>

      {adding && (
        <form onSubmit={addAddress} className="mb-3 flex flex-wrap gap-2">
          <input required autoFocus className={`${field} min-w-[220px] flex-1`} placeholder="Street, barangay, city" value={addr} onChange={(e) => setAddr(e.target.value)} />
          <button className={smallBtn} disabled={busy}>Save</button>
          <button type="button" className={smallBtn} onClick={() => { setAdding(false); setAddr('') }}>Cancel</button>
        </form>
      )}

      <div className="rounded-sm border border-ink/20">
        {addresses.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-4 text-sm text-ink/60"><Navigation size={17} /> No pickup addresses added yet.</div>
        )}
        {addresses.map((a, i) => (
          <div key={`${a}${i}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-4 py-3 first:border-t-0">
            <span className="flex items-center gap-3 text-sm"><Navigation size={17} /> {a}</span>
            <div className="flex items-center gap-3">
              {i === 0 ? (
                <span className="rounded-sm bg-reserved px-2 py-1 text-sm font-semibold">Primary</span>
              ) : (
                <button className="text-sm font-semibold underline" disabled={busy} onClick={() => setPrimaryAddress(i)}>
                  Set as primary
                </button>
              )}
              <button className="text-sm font-semibold text-cleaning underline" disabled={busy}
                onClick={() => save({ addresses: addresses.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {err && <p role="alert" className="mt-4 text-sm text-cleaning">{err}</p>}
      <div className="mt-8 text-center">
        <button onClick={onSignOut}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
          Log out
        </button>
      </div>
    </section>
  )
}