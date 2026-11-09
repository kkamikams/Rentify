import type { ReactNode } from 'react'

export const card = 'mb-6 rounded-sm bg-white p-6 shadow-sm'
export const btn =
  'rounded-sm bg-booked px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)] disabled:opacity-50'
export const btn2 =
  'rounded-sm bg-cell px-4 py-2 text-sm font-semibold text-ink shadow-[0_2px_3px_rgba(0,0,0,0.2)]'
export const input = 'w-full rounded-sm border border-ink/25 bg-white px-2 py-1.5 text-xs text-ink'
export const th = 'py-2 pr-4 text-left text-[11px] font-semibold'
export const td = 'border-t border-ink/15 py-2 pr-4 text-xs'

export const Tag = ({ children }: { children: ReactNode }) => (
  <span className="rounded-sm bg-reserved px-1.5 py-0.5 text-[9px]">{children}</span>
)
export const Sub = ({ children }: { children: ReactNode }) => (
  <p className="-mt-5 mb-5 text-[10px] text-ink/60">{children}</p>
)
export const Field = ({ l, v }: { l: string; v: ReactNode }) => (
  <div>
    <div className="text-[10px] text-ink/60">{l}</div>
    <div className="text-xs font-semibold">{v}</div>
  </div>
)
export const Stat = ({ label, value, tone = '' }: { label: string; value: ReactNode; tone?: string }) => (
  <div className="rounded-sm bg-white p-4 shadow-md">
    <div className="text-sm font-medium">{label}</div>
    <div className={`text-3xl font-bold ${tone}`}>{value}</div>
  </div>
)
