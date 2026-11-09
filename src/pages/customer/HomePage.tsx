import type { CItem } from '../../lib/customer'
import { ItemCard } from './CatalogPage'

const TILES: [string, string][] = [
  ['Gown', 'Gown'], ['Formal wear', 'Formal Wear'], ['Costume', 'Costumes'], ['Barong', 'Barong'],
]

const Heading = ({ children }: { children: string }) => (
  <div className="mb-8 text-center">
    <h2 className="text-sm font-medium tracking-wide">{children}</h2>
    <div className="mx-auto mt-1 h-px w-24 bg-ink" />
  </div>
)

export default function HomePage({
  items, onCategory, onOpen, onBrowse,
}: {
  items: CItem[]
  onCategory: (c: string) => void
  onOpen: (id: string) => void
  onBrowse: () => void
}) {
  const fresh = [...items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 8)

  return (
    <div>
      <section className="bg-reserved">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-14">
          <div>
            <h1 className="text-3xl font-bold leading-snug">
              Dress for the moment,<br />
              Rent it with{' '}
              <span style={{ fontFamily: "'Great Vibes', cursive" }} className="text-4xl font-normal">Rentify.</span>
            </h1>
            <p className="mt-4 text-xs">Find your perfect outfit for every occasion.</p>
            <button onClick={onBrowse}
              className="mt-6 rounded-sm bg-ink px-5 py-2.5 text-xs font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
              Browse Rentals →
            </button>
          </div>
          {/* Put your banner photo at public/hero.png */}
          <img src="/hero.png" alt="" className="hidden h-64 object-contain sm:block"
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <Heading>RENT BY CATEGORY</Heading>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {TILES.map(([value, label]) => {
            const img = items.find((i) => i.category === value && i.image_url)?.image_url
            return (
              <div key={value}
                className="flex h-52 flex-col justify-end rounded-sm bg-white bg-cover bg-center p-3 shadow-md"
                style={img ? { backgroundImage: `url(${img})` } : undefined}>
                <button onClick={() => onCategory(value)}
                  className="w-full rounded-sm bg-booked py-2 text-xs font-semibold text-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
                  {label}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl border-t border-ink/20 px-6 py-10">
        <Heading>NEW ARRIVALS</Heading>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {fresh.map((i) => (
            <div key={i.id} className="w-40 shrink-0"><ItemCard item={i} onOpen={() => onOpen(i.id)} /></div>
          ))}
        </div>
        {fresh.length === 0 && <p className="text-center text-sm text-ink/60">New items will show up here.</p>}
      </section>

      <footer className="bg-[#46352E] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-xs sm:grid-cols-2">
          <div className="space-y-4">
            <div className="text-sm font-semibold">Rentify.</div>
            <button className="block" onClick={onBrowse}>Search</button>
            <button className="block" onClick={onBrowse}>Book A Fitting</button>
            <div>FAQ</div>
            <div>Terms and Conditions</div>
          </div>
          <div className="space-y-4">
            <div>SOCIALS</div>
            <div>Facebook</div>
            <div>Instagram</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
