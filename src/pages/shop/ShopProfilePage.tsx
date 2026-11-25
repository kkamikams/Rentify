import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { CalendarCheck, Camera, CreditCard, MapPin, Package, Store, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Shop } from '../../lib/shop'
import { CATEGORIES, norm } from '../../lib/shop'
import { card } from '../../lib/ui'
import { isValidName, digitsOnly, isValidPhone } from '../../lib/name'

type Meta = { full_name?: string; phone?: string }
type Payment = { number: string; name: string }

const button = 'rounded-sm border border-ink/20 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-cream disabled:opacity-60'
const field = 'w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm'
function Summary({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-sm bg-cream p-4">
      <Icon size={20} className="shrink-0 text-ink/70" />
      <div>
        <p className="text-sm text-ink/70">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}

export default function ShopProfilePage({
  shop, shopName, onSignOut,
}: { shop: Shop; shopName?: string; onSignOut?: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [payment, setPayment] = useState<Payment>({ number: '', name: '' })
  const [savedPayment, setSavedPayment] = useState<Payment>({ number: '', name: '' })
  const [editingOwner, setEditingOwner] = useState(false)
  const [editingPayment, setEditingPayment] = useState(false)
  const [branchNames, setBranchNames] = useState<Record<string, string>>({})
  const [editingBranches, setEditingBranches] = useState(false)
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({})
  const [categoryBusy, setCategoryBusy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active) return
      if (userError) {
        setError(userError.message)
        return
      }
      const currentUser = data.user
      const meta = (currentUser?.user_metadata ?? {}) as Meta
      setUser(currentUser)
      setName(meta.full_name ?? '')
      setPhone(meta.phone ?? '')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!shop.shopId) return
    let active = true
    void (async () => {
      let result = await supabase.from('shops')
        .select('pay_number, pay_name, category_images').eq('id', shop.shopId).maybeSingle()
      if (result.error?.message.includes('category_images')) {
        result = await supabase.from('shops')
          .select('pay_number, pay_name').eq('id', shop.shopId).maybeSingle()
      }
      if (!active) return
      if (result.error) {
        setError(result.error.message)
        return
      }
      if (result.data) {
        const currentPayment = { number: result.data.pay_number ?? '', name: result.data.pay_name ?? '' }
        setPayment(currentPayment)
        setSavedPayment(currentPayment)
      }
      setCategoryImages((result.data?.category_images as Record<string, string> | null) ?? {})
    })()
    return () => { active = false }
  }, [shop.shopId])

  const meta = (user?.user_metadata ?? {}) as Meta
  const pendingRequests = shop.bookings.filter((booking) => norm(booking.status) === 'pending').length
  const activeRentals = shop.bookings.filter((booking) => ['out', 'picked_up', 'active'].includes(norm(booking.status))).length

  async function saveOwner(e: FormEvent) {
    e.preventDefault()
    if (!isValidName(name)) {
      setError('Owner name must contain letters and cannot contain numbers.')
      return
    }
    if (!isValidPhone(phone)) {
      setError('Enter your mobile number using 10 to 15 digits.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: saveError } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), phone: phone.trim() || null },
    })
    setBusy(false)
    if (saveError) return setError(saveError.message)
    setUser(data.user)
    setEditingOwner(false)
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault()
    if (!shop.shopId) {
      setError('Shop details are still loading. Please try again.')
      return
    }
    if (payment.number.trim() && !/^\d{6,20}$/.test(digitsOnly(payment.number))) {
      setError('Enter a valid GCash or bank account number using digits only.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: saveError } = await supabase.from('shops')
      .update({ pay_number: payment.number.trim() || null, pay_name: payment.name.trim() || null })
      .eq('id', shop.shopId).select('id')
    setBusy(false)
    if (saveError) return setError(saveError.message)
    if (!data?.length) return setError('Could not save payment details. Check the shop owner permissions.')
    setPayment({ number: payment.number.trim(), name: payment.name.trim() })
    setSavedPayment({ number: payment.number.trim(), name: payment.name.trim() })
    setEditingPayment(false)
  }

  async function saveBranches(e: FormEvent) {
    e.preventDefault()
    if (shop.branches.some((branch) => branchNames[branch.id] !== undefined && !branchNames[branch.id].trim())) {
      setError('Branch locations cannot be blank.')
      return
    }
    const changed = shop.branches.filter((branch) => (branchNames[branch.id] ?? branch.name).trim() !== branch.name)
    setBusy(true)
    setError('')
    for (const branch of changed) {
      const { data, error: saveError } = await supabase.from('branches')
        .update({ name: branchNames[branch.id].trim() }).eq('id', branch.id).select('id')
      if (saveError) {
        setBusy(false)
        setError(saveError.message)
        return
      }
      if (!data?.length) {
        setBusy(false)
        setError(`Could not update ${branch.name}. Check the branch owner permissions.`)
        return
      }
    }
    await shop.reload()
    setBusy(false)
    setBranchNames({})
    setEditingBranches(false)
  }

  async function uploadCategoryPhoto(category: string, file: File) {
    if (!shop.shopId) {
      setError('Shop details are still loading. Please try again.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }

    setCategoryBusy(category)
    setError('')
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${shop.shopId}/categories/${category.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID()}.${extension}`
    try {
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(path, file, { contentType: file.type, cacheControl: '3600' })
      if (uploadError) throw new Error(uploadError.message)

      const url = supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
      const next = { ...categoryImages, [category]: url }
      const { data, error: saveError } = await supabase.from('shops')
        .update({ category_images: next }).eq('id', shop.shopId).select('id')
      if (saveError || !data?.length) {
        await supabase.storage.from('item-images').remove([path])
        throw new Error(saveError?.message ?? 'Could not save the category photo. Your account may not have shop owner permission.')
      }

      const oldUrl = categoryImages[category]
      setCategoryImages(next)
      if (oldUrl) {
        const marker = '/item-images/'
        const index = oldUrl.indexOf(marker)
        if (index >= 0) {
          const oldPath = decodeURIComponent(oldUrl.slice(index + marker.length).split('?')[0])
          await supabase.storage.from('item-images').remove([oldPath])
        }
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to upload category photo.')
    } finally {
      setCategoryBusy('')
    }
  }

  async function removeCategoryPhoto(category: string) {
    if (!shop.shopId) return
    setCategoryBusy(category)
    setError('')
    const next = { ...categoryImages }
    const oldUrl = next[category]
    delete next[category]
    try {
      const { data, error: saveError } = await supabase.from('shops')
        .update({ category_images: next }).eq('id', shop.shopId).select('id')
      if (saveError || !data?.length) {
        throw new Error(saveError?.message ?? 'Could not remove the category photo.')
      }
      setCategoryImages(next)
      if (oldUrl) {
        const marker = '/item-images/'
        const index = oldUrl.indexOf(marker)
        if (index >= 0) {
          const oldPath = decodeURIComponent(oldUrl.slice(index + marker.length).split('?')[0])
          await supabase.storage.from('item-images').remove([oldPath])
        }
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to remove category photo.')
    } finally {
      setCategoryBusy('')
    }
  }

  return (
    <div className="w-full">
      <section className={`${card} flex flex-wrap items-center gap-4`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream">
          <Store size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">Shop profile</p>
          <h2 className="truncate text-2xl font-bold">{shopName || 'Your shop'}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink/70">
            <MapPin size={15} />
            {shop.branches.length ? shop.branches.map((branch) => branch.name).join(' · ') : 'No branches added yet'}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary icon={Package} label="Items in inventory" value={shop.items.length} />
        <Summary icon={CalendarCheck} label="Pending requests" value={pendingRequests} />
        <Summary icon={Store} label="Active rentals" value={activeRentals} />
      </section>

      <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <MapPin size={19} />
            <h3 className="text-lg font-bold">{shop.branches.length === 1 ? 'Main branch location' : 'Branch locations'}</h3>
          </div>
          {editingBranches ? (
            <form onSubmit={saveBranches} className="mt-4 space-y-3">
              {shop.branches.map((branch) => (
                <label key={branch.id} className="block text-sm text-ink/70">
                  {shop.branches.length === 1 ? 'Location name' : branch.name}
                  <input required className={`${field} mt-1`} value={branchNames[branch.id] ?? branch.name}
                    onChange={(e) => setBranchNames({ ...branchNames, [branch.id]: e.target.value })} />
                </label>
              ))}
              <div className="flex gap-2">
                <button className={button} disabled={busy}>{busy ? 'Saving…' : 'Save location'}</button>
                <button type="button" className={button} onClick={() => {
                  setBranchNames({})
                  setEditingBranches(false)
                }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-ink/70">
              {shop.branches.length ? shop.branches.map((branch) => branch.name).join(' · ') : 'No branch locations added yet'}
            </p>
          )}
        </div>
        {!editingBranches && shop.branches.length > 0 && (
          <button type="button" className={button} onClick={() => setEditingBranches(true)}>Edit location</button>
        )}
      </section>

      <section className={card}>
        <div className="mb-2 flex items-center gap-2">
          <Camera size={19} />
          <h3 className="text-lg font-bold">Category photos</h3>
        </div>
        <p className="mb-5 text-sm text-ink/70">
          Add a photo for each category shown on the customer homepage.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const image = categoryImages[category]
            const busyCategory = categoryBusy === category
            return (
              <div key={category} className="overflow-hidden rounded-sm border border-ink/15 bg-white">
                <div className="h-40 bg-cell bg-cover bg-center"
                  style={image ? { backgroundImage: `url(${image})` } : undefined}>
                  {!image && (
                    <div className="flex h-full items-center justify-center text-sm text-ink/50">No photo</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="mb-3 font-semibold">{category}</p>
                  <div className="flex flex-wrap gap-3">
                    <label className="cursor-pointer text-sm font-semibold underline">
                      {busyCategory ? 'Saving…' : image ? 'Change photo' : 'Add photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={busyCategory}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadCategoryPhoto(category, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {image && (
                      <button type="button" className="text-sm font-semibold text-cleaning underline"
                        disabled={busyCategory} onClick={() => void removeCategoryPhoto(category)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center gap-2">
          <CreditCard size={19} />
          <h3 className="text-lg font-bold">Customer payment details</h3>
        </div>
        <p className="mb-4 text-sm text-ink/70">
          Customers use these details when they submit an online reservation.
        </p>
        {editingPayment ? (
          <form onSubmit={savePayment} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/70">
              GCash or bank account number
              <input type="tel" inputMode="numeric" minLength={6} maxLength={20} pattern="[0-9]{6,20}" className={`${field} mt-1`} placeholder="Account number" value={payment.number}
                onChange={(e) => setPayment({ ...payment, number: digitsOnly(e.target.value) })} />
            </label>
            <label className="text-sm text-ink/70">
              Account holder name
              <input className={`${field} mt-1`} placeholder="Name on the account" value={payment.name}
                onChange={(e) => setPayment({ ...payment, name: e.target.value })} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={button} disabled={busy}>{busy ? 'Saving…' : 'Save payment details'}</button>
              <button type="button" className={button} onClick={() => {
                setPayment(savedPayment)
                setEditingPayment(false)
              }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ink/15 px-4 py-3">
            <div>
              <p className="font-semibold">{payment.number || 'No payment details added'}</p>
              {payment.name && <p className="mt-1 text-sm text-ink/70">{payment.name}</p>}
            </div>
            <button type="button" className={button} onClick={() => setEditingPayment(true)}>Edit details</button>
          </div>
        )}
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserRound size={19} />
            <h3 className="text-lg font-bold">Owner account</h3>
          </div>
          {!editingOwner && (
            <button type="button" className={button} onClick={() => setEditingOwner(true)}>Edit contact</button>
          )}
        </div>
        {editingOwner ? (
          <form onSubmit={saveOwner} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/70">
              Owner name
              <input required className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value.replace(/[\p{N}\d]/gu, ''))} />
            </label>
            <label className="text-sm text-ink/70">
              Mobile number
              <input type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" required className={`${field} mt-1`} placeholder="Mobile number" value={phone}
                onChange={(e) => setPhone(digitsOnly(e.target.value))} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={button} disabled={busy}>{busy ? 'Saving…' : 'Save contact'}</button>
              <button type="button" className={button} onClick={() => {
                setEditingOwner(false)
                setName(meta.full_name ?? '')
                setPhone(meta.phone ?? '')
              }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink/60">Owner</dt>
              <dd className="font-semibold">{meta.full_name || 'Name not added'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/60">Email</dt>
              <dd className="break-all font-semibold">{user?.email || 'Loading…'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/60">Mobile</dt>
              <dd className="font-semibold">{meta.phone || 'Not added'}</dd>
            </div>
          </dl>
        )}
      </section>

      {error && <p role="alert" className="text-sm font-medium text-cleaning">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={onSignOut}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">
          Log out
        </button>
      </div>
    </div>
  )
}
