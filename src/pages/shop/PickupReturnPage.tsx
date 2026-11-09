import { useState } from 'react'

const PIECES = [
  { id: 'gown', name: 'Gown', replace: 500 },
  { id: 'petticoat', name: 'Petticoat', replace: 500 },
]
const DEPOSIT = 1000

const peso = (n: number) => `₱${n.toLocaleString()}`

const selectCls =
  'w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm text-ink'

export default function PickupReturnPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [daysLate, setDaysLate] = useState(0)
  const [condition, setCondition] = useState('Good')
  const [deposit, setDeposit] = useState(false)
  const [method, setMethod] = useState('Cash')

  const missing = PIECES.filter((p) => !checked[p.id])
  const missingFee = missing.reduce((sum, p) => sum + p.replace, 0)

  return (
    <section className="max-w-3xl rounded-sm bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold">Pickup Checklist</h2>
      <p className="mb-6 mt-1 text-[10px] text-ink/70">
        Emerald ball gown for <strong>M. Reyes</strong>.<br />
        Tick each piece you hand over or receive.
      </p>

      <ul className="mb-5 border-b border-ink/15">
        {PIECES.map((p) => (
          <li key={p.id} className="flex items-center justify-between border-t border-ink/15 py-3 first:border-t-0">
            <label className="flex cursor-pointer items-center gap-4 font-medium">
              <input
                type="checkbox"
                checked={!!checked[p.id]}
                onChange={(e) => setChecked({ ...checked, [p.id]: e.target.checked })}
                className="h-4 w-4 accent-booked"
              />
              {p.name}
            </label>
            <span className="text-[11px] text-ink/70">Replace {peso(p.replace)}</span>
          </li>
        ))}
      </ul>

      <div className="mb-5 grid grid-cols-2 gap-8">
        <label className="text-[11px] text-ink/70">
          Days Late
          <select className={`${selectCls} mt-1`} value={daysLate} onChange={(e) => setDaysLate(+e.target.value)}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-ink/70">
          Condition
          <select className={`${selectCls} mt-1`} value={condition} onChange={(e) => setCondition(e.target.value)}>
            {['Good', 'Needs cleaning', 'Needs repair', 'Damaged'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-4 font-semibold">
          <input
            type="checkbox"
            checked={deposit}
            onChange={(e) => setDeposit(e.target.checked)}
            className="h-4 w-4 accent-booked"
          />
          Deposit {peso(DEPOSIT)} received
        </label>
        <select className={`${selectCls} w-28`} value={method} onChange={(e) => setMethod(e.target.value)}>
          {['Cash', 'GCash', 'Card'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <button
        disabled={!deposit}
        className="mb-6 rounded-sm bg-booked px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)] disabled:opacity-50"
      >
        Hand over, mark out
      </button>

      <div className="border-t border-ink/15 pt-4 text-sm">
        <div className="flex justify-between py-1">
          <span>Missing items ({missing.length})</span><span>{peso(missingFee)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Late fee ({daysLate} {daysLate === 1 ? 'day' : 'days'})</span><span>{peso(0)}</span>
        </div>
      </div>
    </section>
  )
}
