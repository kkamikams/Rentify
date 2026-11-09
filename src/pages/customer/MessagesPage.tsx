import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { CBranch, Msg } from '../../lib/customer'

const time = (s: string) => new Date(s).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export default function MessagesPage({
  session, branches, initialBranch,
}: { session: Session; branches: CBranch[]; initialBranch?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [sel, setSel] = useState(initialBranch ?? '')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at')
    if (error) setErr(error.message)
    else setMsgs((data ?? []) as unknown as Msg[])
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // check for new replies
    return () => clearInterval(t)
  }, [load])

  const cur = branches.find((b) => b.id === sel) ?? branches[0]
  const thread = msgs.filter((m) => m.branch_id === cur?.id)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!cur || !text.trim()) return
    const { error } = await supabase.from('messages').insert({
      shop_id: cur.shop_id, branch_id: cur.id, customer_id: session.user.id, sender: 'customer', body: text.trim(),
    })
    if (error) setErr(error.message)
    else { setText(''); load() }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-6 py-6 md:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-sm bg-white p-4 shadow-md">
        <h1 className="mb-3 border-b border-ink/20 pb-3 text-lg font-bold">Messages</h1>
        {branches.map((b) => {
          const last = msgs.filter((m) => m.branch_id === b.id).at(-1)
          return (
            <button key={b.id} onClick={() => setSel(b.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-sm p-2 text-left ${cur?.id === b.id ? 'bg-cream' : ''}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-reserved"><User size={16} /></span>
              <span className="min-w-0 text-[10px]">
                <span className="block text-xs font-semibold">{b.name}</span>
                <span className="block truncate text-ink/60">{last?.body ?? 'No messages yet'}</span>
              </span>
            </button>
          )
        })}
      </aside>

      <section className="flex min-h-[420px] flex-col rounded-sm bg-white shadow-md">
        <header className="flex items-center gap-3 border-b border-ink/20 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-reserved"><User size={18} /></span>
          <span className="text-base font-semibold">{cur?.name}</span>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {thread.map((m, i) => {
            const gap = i === 0 || new Date(m.created_at).getTime() - new Date(thread[i - 1].created_at).getTime() > 3600000
            return (
              <div key={m.id} className="flex flex-col gap-3">
                {gap && <div className="text-center text-[9px] text-ink/50">{time(m.created_at)}</div>}
                <div className={`max-w-[70%] rounded-xl px-3 py-2 text-[11px] ${
                  m.sender === 'customer' ? 'self-end bg-booked text-white' : 'self-start bg-reserved'}`}>
                  {m.body}
                </div>
              </div>
            )
          })}
          {thread.length === 0 && <p className="m-auto text-xs text-ink/50">Say hi to {cur?.name}.</p>}
        </div>
        {err && <p className="px-4 text-xs text-cleaning">{err}</p>}
        <form onSubmit={send} className="flex gap-3 p-4">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message"
            className="flex-1 rounded-md border border-ink/40 bg-white px-3 py-2 text-xs" />
          <button className="rounded-sm bg-ink px-6 py-2 text-sm font-semibold text-white">Send</button>
        </form>
      </section>
    </div>
  )
}
