import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail, Phone, User, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { isValidName, digitsOnly, isValidPhone } from '../lib/name'

type Role = 'customer' | 'shop'
const LABEL: Record<Role, string> = { customer: 'Customer', shop: 'Shop owner' }

const inputCls =
  'w-full rounded-xl bg-ink/[0.06] py-3 pl-10 pr-3 text-sm text-ink ' +
  'placeholder:text-ink/50 outline-none ring-1 ring-transparent transition ' +
  'focus:bg-white focus:ring-booked'

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/60">
        {icon}
      </span>
      {children}
    </div>
  )
}

export default function AuthPage({ onHome }: { onHome?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<Role>('customer')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (mode === 'signup' && !isValidName(fullName)) {
      setError('Full name must contain letters and cannot contain numbers.')
      return
    }
    if (mode === 'signup' && role === 'customer' && !isValidPhone(phone)) {
      setError('Enter your mobile number using 10 to 15 digits.')
      return
    }
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

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setError('')
    setInfo('')
  }

  return (
<<<<<<< HEAD
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="w-full max-w-sm rounded-sm bg-white p-8 shadow-sm">
        {mode === 'signup' && (
          <button
            type="button"
            className="mb-4 flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-ink"
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
            aria-label="Back to log in"
          >
            <ArrowLeft size={16} />
            Back to log in
          </button>
        )}
        <h1 className="text-2xl font-semibold">Rentify.</h1>
        <p className="mb-6 mt-1 text-sm text-ink/60">
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
              <input required className={inputCls} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value.replace(/[\p{N}\d]/gu, ''))} />
              {role === 'customer' && (
                <input type="tel" inputMode="numeric" minLength={10} maxLength={15} pattern="[0-9]{10,15}" required className={inputCls} placeholder="Mobile number" value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
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

        <p className="mt-6 text-sm text-ink/70">
          {mode === 'login' ? 'New to Rentify?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
=======
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#E6C3B1_0%,#F1DCCF_45%,#F8F3EA_100%)] text-ink">
      {/* Soft clouds */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2">
        <div className="absolute -bottom-24 -left-20 h-72 w-[28rem] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-80 w-[34rem] rounded-full bg-white/90 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-72 w-[30rem] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute bottom-24 left-[8%] h-28 w-64 rounded-full bg-white/50 blur-2xl" />
        <div className="absolute bottom-40 right-[10%] h-24 w-56 rounded-full bg-white/50 blur-2xl" />
>>>>>>> backup-remote
      </div>

      {/* Rentify wordmark: top-middle, links to the homepage */}
      <header className="relative z-10 flex justify-center pt-8">
        <a
          href="/"
          aria-label="Rentify home"
          onClick={(e) => { if (onHome) { e.preventDefault(); onHome() } }}
          className="text-xl font-semibold tracking-tight text-ink"
        >
          Rentify
        </a>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-gradient-to-b from-reserved/50 via-white/80 to-white/90 p-7 shadow-[0_20px_60px_-15px_rgba(110,70,50,0.35)] backdrop-blur-xl">
          {mode === 'signup' && (
            <button
              type="button"
              className="mb-3 flex items-center gap-1 text-sm font-medium text-ink/70 hover:text-ink"
              onClick={() => switchMode('login')}
              aria-label="Back to log in"
            >
              <ArrowLeft size={16} />
              Back to log in
            </button>
          )}

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink shadow-[0_4px_14px_rgba(110,70,50,0.18)] ring-1 ring-white">
            {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
          </div>
          <h1 className="text-center text-xl font-semibold">
            {mode === 'login' ? 'Log in to Rentify' : 'Create your account'}
          </h1>
          <p className="mb-6 mt-1 text-center text-sm text-ink/60">
            {mode === 'login'
              ? 'Rent smarter. Pick your account type to continue.'
              : 'Join Rentify as a customer or a shop owner.'}
          </p>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-ink/[0.08] p-1">
            {(['customer', 'shop'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  role === r
                    ? 'bg-gradient-to-b from-[#B27C6A] to-[#8C5646] text-white shadow'
                    : 'text-ink/70 hover:text-ink'
                }`}
              >
                {LABEL[r]}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <Field icon={<User size={16} />}>
                  <input required className={inputCls} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                {role === 'customer' && (
                  <Field icon={<Phone size={16} />}>
                    <input type="tel" className={inputCls} placeholder="Mobile number (09xx xxx xxxx)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                )}
              </>
            )}
            <Field icon={<Mail size={16} />}>
              <input required type="email" className={inputCls} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field icon={<Lock size={16} />}>
              <input
                required
                minLength={6}
                type={showPassword ? 'text' : 'password'}
                className={`${inputCls} pr-10`}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Field>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-xl bg-gradient-to-b from-[#B27C6A] to-[#8C5646] px-3 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_-4px_rgba(90,50,35,0.45)] transition hover:brightness-110 disabled:opacity-50"
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                  ? `Log in as ${LABEL[role].toLowerCase()}`
                  : `Sign up as ${LABEL[role].toLowerCase()}`}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-cleaning">{error}</p>}
          {info && <p className="mt-4 text-sm text-green-800">{info}</p>}

          <p className="mt-6 text-center text-sm text-ink/70">
            {mode === 'login' ? 'New to Rentify?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-semibold text-ink underline"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
