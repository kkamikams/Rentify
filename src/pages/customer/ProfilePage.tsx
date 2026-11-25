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
  const [firstName, setFirstName] = useState(meta.full_name?.split(' ')[0] ?? '')
  const [lastName, setLastName] = useState(meta.full_name?.split(' ').slice(1).join(' ') ?? '')
  const [address, setAddress] = useState('')
  const [apartment, setApartment] = useState('')
  const [barangay, setBarangay] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [isDefault, setIsDefault] = useState(false)
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
  function closeAddressModal() {
    setAdding(false)
    setAddress('')
    setApartment('')
    setBarangay('')
    setPostalCode('')
    setCity('')
    setRegion('')
    setIsDefault(false)
  }

  async function addAddress(e: FormEvent) {
    e.preventDefault()
    if (!address.trim() || !barangay.trim() || !city.trim()) return

    const formattedAddress = [
      apartment.trim(),
      address.trim(),
      barangay.trim(),
      city.trim(),
      region.trim(),
      postalCode.trim(),
    ].filter(Boolean).join(', ')

    const nextAddresses = isDefault
      ? [formattedAddress, ...addresses]
      : [...addresses, formattedAddress]

    if (await save({ addresses: nextAddresses })) closeAddressModal()
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAddressModal() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-address-title" className="w-full max-w-md rounded-sm bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="add-address-title" className="text-lg font-bold">Add address</h2>
              <button type="button" aria-label="Close" className="text-2xl leading-none text-ink/70" onClick={closeAddressModal}>×</button>
            </div>

            <form onSubmit={addAddress} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-sm border border-ink/20 px-3 py-2 text-sm">
                <span className="block text-[10px] text-ink/60">Country/region</span>
                <span>Philippines</span>
              </div>

              <input required aria-label="First name" placeholder="First name" className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input required aria-label="Last name" placeholder="Last name" className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} />

              <input required aria-label="Address" placeholder="Address" className={`${field} col-span-2`} value={address} onChange={(e) => setAddress(e.target.value)} />
              <input aria-label="Apartment, suite, etc." placeholder="Apartment, suite, etc." className={field} value={apartment} onChange={(e) => setApartment(e.target.value)} />
              <input required aria-label="Barangay" placeholder="Barangay" className={field} value={barangay} onChange={(e) => setBarangay(e.target.value)} />
              <input aria-label="Postal code" placeholder="Postal code" className={field} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              <input required aria-label="City" placeholder="City" className={field} value={city} onChange={(e) => setCity(e.target.value)} />

              <input aria-label="Region" placeholder="Region" className={`${field} col-span-2`} value={region} onChange={(e) => setRegion(e.target.value)} />

              <label className="col-span-2 flex items-center gap-2 text-xs text-ink/70">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                This is my default address
              </label>

              <div className="col-span-2 mt-2 flex justify-end gap-3">
                <button type="button" className="text-sm underline" onClick={closeAddressModal}>Cancel</button>
                <button type="submit" disabled={busy} className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save</button>
              </div>
            </form>
          </section>
        </div>
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
          className="rounded-sm bg-[#45352F] px-5 py-2.5 text-sm font-semibold text-[#F8F3EB] shadow-[0_4px_2px_0_rgba(0,0,0,0.25)] transition-shadow duration-20 hover:bg-[#45352F] hover:text-[#F8F3EB] hover:[text-shadow:0_0_10px_rgba(248,243,235,1)] hover:shadow-[0_0_10px_0_rgba(69,53,47,1)] active:bg-[#45352F] active:text-white active:shadow-[inset_0_2px_7px_0_rgba(0,0,0,0.25),0_0_10px_0_rgba(69,53,47,1)]">
          Log out
        </button>
      </div>
    </section>
  )
}