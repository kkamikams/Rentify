import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Booking, Shop } from '../../lib/shop'
import { inBranch } from '../../lib/shop'
import { Tag } from '../../lib/ui'

type Row = { id: string; branch_id: string; customer_id: string; sender: string; body: string; created_at: string }
type CB = Booking & { customer_id?: string | null }

const time = (s: string) =>
  new Date(s).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function ShopMessagesPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [msgs, setMsgs] = useState<Row[]>([])
  const [sel, setSel] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!shop.shopId) return
    const { data, error } = await supabase.from('messages').select('*').eq('shop_id', shop.shopId).order('created_at')
    if (error) setErr(error.message)
    else setMsgs((data ?? []) as unknown as Row[])
  }, [shop.shopId])
  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // check for new messages
    return () => clearInterval(t)
  }, [load])

  const branchNm = (id: string) => shop.branches.find((b) => b.id === id)?.name ?? ''
  const nameOf = (cid: string) =>
    (shop.bookings as CB[]).find((b) => b.customer_id === cid)?.customer_name ?? 'Customer'

  const convs = useMemo(() => {
    const m = new Map<string, Row[]>()
    msgs.filter((x) => inBranch(branch, branchNm(x.branch_id))).forEach((x) => {
      const k = `${x.customer_id}|${x.branch_id}`
      m.set(k, [...(m.get(k) ?? []), x])
    })
    return [...m.entries()]
      .map(([key, list]) => ({ key, list, last: list[list.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
  }, [msgs, branch, shop.branches])

  const cur = convs.find((c) => c.key === sel) ?? convs[0]
  const multi = shop.branches.length > 1

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!cur || !text.trim()) return
    const [customer_id, branch_id] = cur.key.split('|')
    const { error } = await supabase.from('messages').insert({
      shop_id: shop.shopId, branch_id, customer_id, sender: 'shop', body: text.trim(),
    })
    if (error) setErr(error.message)
    else { setText(''); setErr(''); load() }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-sm bg-white p-4 shadow-md">
        <h2 className="mb-3 border-b border-ink/20 pb-3 text-lg font-bold">Messages</h2>
        {convs.length === 0 && <p className="text-xs text-ink/50">No messages yet.</p>}
        {convs.map((c) => (
          <button key={c.key} onClick={() => setSel(c.key)}
            className={`mb-1 flex w-full items-center gap-3 rounded-sm p-2 text-left ${cur?.key === c.key ? 'bg-cream' : ''}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-reserved"><User size={16} /></span>
            <span className="min-w-0 text-[10px]">
              <span className="block text-xs font-semibold">{nameOf(c.last.customer_id)}</span>
              {multi && <Tag>{branchNm(c.last.branch_id)}</Tag>}
              <span className="block truncate text-ink/60">{c.last.body}</span>
            </span>
          </button>
        ))}
      </aside>

      <section className="flex min-h-[420px] flex-col rounded-sm bg-white shadow-md">
        <header className="border-b border-ink/20 p-4 text-base font-semibold">
          {cur ? nameOf(cur.last.customer_id) : 'Select a conversation'}
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {cur?.list.map((m) => (
            <div key={m.id} className={`max-w-[70%] ${m.sender === 'shop' ? 'self-end' : 'self-start'}`}>
              <div className={`rounded-xl px-3 py-2 text-[11px] ${m.sender === 'shop' ? 'bg-booked text-white' : 'bg-reserved'}`}>{m.body}</div>
              <div className="mt-0.5 text-[9px] text-ink/50">{time(m.created_at)}</div>
            </div>
          ))}
        </div>
        {err && <p className="px-4 text-xs text-cleaning">{err}</p>}
        <form onSubmit={send} className="flex gap-3 p-4">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" disabled={!cur}
            className="flex-1 rounded-md border border-ink/40 bg-white px-3 py-2 text-xs" />
          <button disabled={!cur} className="rounded-sm bg-ink px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">Send</button>
        </form>
      </section>
    </div>
  )
}
