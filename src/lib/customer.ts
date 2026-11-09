import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export type CItem = {
  id: string; shop_id: string; name: string; category: string | null
  branch_id: string | null; price_per_day: number | null; deposit: number | null
  late_fee_per_day: number | null; buffer_days: number | null; inclusions: string | null
  image_url: string | null; created_at: string | null
  branches: { name: string } | null
}
export type CBranch = { id: string; shop_id: string; name: string }
export type CShop = { id: string; pay_number: string | null; pay_name: string | null }
export type MyBooking = {
  id: string; item_id: string; start_date: string; end_date: string; status: string | null
  payment_ref: string | null; payment_method: string | null; deposit_amount: number | null
  extension_requested: boolean; items: CItem | null
}
export type Msg = { id: string; branch_id: string; sender: string; body: string; created_at: string }

export const CATEGORY_TABS: [string, string][] = [
  ['All', 'All'], ['Gown', 'Gown'], ['Formal wear', 'Formal Wear'], ['Costume', 'Costume'], ['Barong', 'Barong'],
]
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting confirmation', reserved: 'Reserved', out: 'Picked up', in_transit: 'Returned',
  returned: 'Returned', cleaning: 'Returned', ready: 'Returned', cancelled: 'Cancelled',
}
export const longDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })
}

// Public catalog: items, branches and the shop's payment details
export function useCatalog() {
  const [items, setItems] = useState<CItem[]>([])
  const [branches, setBranches] = useState<CBranch[]>([])
  const [shops, setShops] = useState<CShop[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const [i, b, s] = await Promise.all([
        supabase.from('items').select('*, branches(name)').order('name'),
        supabase.from('branches').select('id, shop_id, name').order('name'),
        supabase.from('shops').select('id, pay_number, pay_name'),
      ])
      setError(i.error?.message ?? b.error?.message ?? s.error?.message ?? '')
      setItems((i.data ?? []) as unknown as CItem[])
      setBranches((b.data ?? []) as unknown as CBranch[])
      setShops((s.data ?? []) as unknown as CShop[])
    })()
  }, [])

  return { items, branches, shops, error }
}