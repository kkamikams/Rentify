import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

type Role = 'customer' | 'shop'
const LABEL: Record<Role, string> = { customer: 'Customer', shop: 'Shop owner' }
const inputCls = 'w-full rounded-sm border border-ink/25 bg-white px-3 py-2.5 text-sm'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<Role>('customer')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, full_name: fullName.trim(), phone: phone.trim() || null } },
      })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Check your email to confirm your account, then log in.')
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Accounts made before roles existed were all shop accounts
        const actual: Role = data.user.user_metadata?.role === 'customer' ? 'customer' : 'shop'
        if (actual !== role) {
          await supabase.auth.signOut()
          setError(`This is a ${LABEL[actual].toLowerCase()} account. Choose "${LABEL[actual]}" above.`)
        }
      }
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="w-full max-w-sm rounded-sm bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Rentify.</h1>
        <p className="mb-6 mt-1 text-xs text-ink/60">
          {mode === 'login' ? 'Log in to your account.' : 'Create your account.'}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-2">
          {(['customer', 'shop'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-sm px-3 py-2 text-sm font-medium ${
                role === r ? 'bg-ink text-cream' : 'bg-cell text-ink'
              }`}
            >
              {LABEL[r]}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <input required className={inputCls} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              {role === 'customer' && (
                <input type="tel" className={inputCls} placeholder="Mobile number (09xx xxx xxxx)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
            </>
          )}
          <input required type="email" className={inputCls} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" minLength={6} className={inputCls} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-booked px-3 py-2.5 text-sm font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)] disabled:opacity-50"
          >
            {busy ? 'Please wait...' : mode === 'login' ? `Log in as ${LABEL[role].toLowerCase()}` : `Sign up as ${LABEL[role].toLowerCase()}`}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-cleaning">{error}</p>}
        {info && <p className="mt-4 text-sm text-green-800">{info}</p>}

        <p className="mt-6 text-xs text-ink/70">
          {mode === 'login' ? 'New to Rentify?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
