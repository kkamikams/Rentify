import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export type Item = {
  id: string; shop_id: string; name: string; category: string | null
  branch_id: string | null; price_per_day: number | null; deposit: number | null
  late_fee_per_day: number | null; buffer_days: number | null; inclusions: string | null
  branches: { name: string } | null
}
export type Booking = {
  id: string; shop_id: string; item_id: string
  customer_name: string | null; customer_phone: string | null
  start_date: string; end_date: string; status: string | null
  note: string | null; payment_ref: string | null; deposit_amount: number | null
  late_fee: number | null; items: Item | null
}
export type Cost = {
  id: string; branch_id: string | null; item_id: string | null
  category: string; description: string | null; amount: number
}
export type Rule = { category: string; buffer_days: number; deposit: number }
export type Branch = { id: string; name: string }
export type Shop = ReturnType<typeof useShop>

export const CATEGORIES = ['Gown', 'Barong', 'Costume', 'Formal wear']

/* ---------- dates ---------- */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const utc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const today = () => iso(new Date())
export const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return iso(new Date(y, m - 1, d + n))
}
export const diffDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000)
export const fmt = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

/* ---------- money + booking helpers ---------- */
export const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH')
export const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
export const nights = (b: Booking) => diffDays(b.start_date, b.end_date) + 1
export const rental = (b: Booking) => (b.items?.price_per_day ?? 0) * nights(b)
export const income = (b: Booking) => rental(b) + (b.late_fee ?? 0)
export const isCancelled = (b: Booking) => ['cancelled', 'canceled', 'declined'].includes(norm(b.status))
export const isSold = (b: Booking) => !isCancelled(b) && norm(b.status) !== 'pending'
export const branchName = (b: Booking) => b.items?.branches?.name ?? ''
export const inBranch = (branch: string, name?: string) => branch === 'All branches' || name === branch

// Another confirmed booking of the same item that overlaps these dates or their cleaning days
export function clash(b: Booking, all: Booking[]) {
  const buf = b.items?.buffer_days ?? 0
  return all.find(
    (o) =>
      o.id !== b.id && o.item_id === b.item_id && isSold(o) &&
      b.start_date <= addDays(o.end_date, buf) && o.start_date <= addDays(b.end_date, buf)
  )
}

/* ---------- load everything for the shop ---------- */
export function useShop(shopId?: string) {
  const [items, setItems] = useState<Item[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!shopId) return
    const [i, b, br, c, r] = await Promise.all([
      supabase.from('items').select('*, branches(name)').eq('shop_id', shopId).order('name'),
      supabase.from('bookings').select('*, items(*, branches(name))').eq('shop_id', shopId).order('start_date'),
      supabase.from('branches').select('id, name').eq('shop_id', shopId).order('name'),
      supabase.from('costs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('type_rules').select('*').eq('shop_id', shopId),
    ])
    setError(i.error?.message ?? b.error?.message ?? br.error?.message ?? c.error?.message ?? r.error?.message ?? '')
    setItems((i.data ?? []) as unknown as Item[])
    setBookings((b.data ?? []) as unknown as Booking[])
    setBranches((br.data ?? []) as unknown as Branch[])
    setCosts((c.data ?? []) as unknown as Cost[])
    setRules((r.data ?? []) as unknown as Rule[])
  }, [shopId])

  useEffect(() => { reload() }, [reload])

  // Run a Supabase write, then refresh the data
  const act = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) setError(error.message)
    else await reload()
  }

  return { shopId, items, bookings, branches, costs, rules, error, reload, act }
}