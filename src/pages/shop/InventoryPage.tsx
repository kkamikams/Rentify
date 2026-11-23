import { useEffect, useMemo, useState } from 'react'
import type { FocusEvent, FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Item, Shop } from '../../lib/shop'
import { CATEGORIES, inBranch } from '../../lib/shop'
import { btn, card, input, Sub, td, th } from '../../lib/ui'

const BUCKET = 'item-images'
const MAX_MB = 5

const num = (e: FocusEvent<HTMLInputElement>) => Number(e.target.value) || 0
const sizeOf = (i: Item) => (i as Item & { size_info?: string | null }).size_info ?? ''
const imageOf = (i: Item) => (i as Item & { image_url?: string | null }).image_url ?? null

// Check the file is an image and not too big. Returns an error message or ''.
const checkImage = (f: File) =>
  !f.type.startsWith('image/') ? 'Choose an image file.'
    : f.size > MAX_MB * 1024 * 1024 ? `Image must be under ${MAX_MB} MB.`
    : ''

// Upload to storage and return { path, url }
async function uploadImage(shopId: string | undefined, file: File) {
  if (!shopId) throw new Error('Shop is still loading. Try again in a moment.')
  const extension = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${shopId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (error) throw new Error(error.message)
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return { path, url }
}

// Turn a public URL back into its storage path so the old photo can be deleted
const pathFromUrl = (url: string | null) => {
  const marker = `/${BUCKET}/`
  const i = url ? url.indexOf(marker) : -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split('?')[0]) : null
}

export default function InventoryPage({ shop, branch }: { shop: Shop; branch: string }) {
  const [f, setF] = useState({ name: '', category: CATEGORIES[0], branch_id: '', price: '', deposit: '', inclusions: '', sizes: '' })
  const [image, setImage] = useState<File | null>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [photoBusy, setPhotoBusy] = useState('') // id of the item whose photo is uploading
  const [photoError, setPhotoError] = useState('')
  const list = shop.items.filter((i) => inBranch(branch, i.branches?.name))
  const save = (id: string, patch: object) => shop.act(supabase.from('items').update(patch).eq('id', id))
  const set = (k: string, v: string) => setF({ ...f, [k]: v })

  // Preview of the photo chosen in the add form
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // Change (or first-time add) the photo of an existing item
  async function changePhoto(item: Item, file: File | undefined) {
    if (!file) return
    const problem = checkImage(file)
    if (problem) { setPhotoError(problem); return }
    setPhotoBusy(item.id)
    setPhotoError('')
    let uploaded: { path: string; url: string } | null = null
    try {
      uploaded = await uploadImage(shop.shopId, file)
      const { error } = await supabase.from('items').update({ image_url: uploaded.url }).eq('id', item.id)
      if (error) throw new Error(error.message)

      // Best effort: delete the old photo so storage doesn't fill up
      const oldPath = pathFromUrl(imageOf(item))
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])

      await shop.reload()
    } catch (e) {
      // Update failed, so remove the file we just uploaded
      if (uploaded) await supabase.storage.from(BUCKET).remove([uploaded.path])
      setPhotoError(e instanceof Error ? e.message : 'Unable to change photo.')
    } finally {
      setPhotoBusy('')
    }
  }

  async function removePhoto(item: Item) {
    if (!window.confirm(`Remove the photo of ${item.name}?`)) return
    setPhotoBusy(item.id)
    setPhotoError('')
    const { error } = await supabase.from('items').update({ image_url: null }).eq('id', item.id)
    if (error) setPhotoError(error.message)
    else {
      const oldPath = pathFromUrl(imageOf(item))
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
      await shop.reload()
    }
    setPhotoBusy('')
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    let imagePath: string | null = null
    try {
      let imageUrl: string | null = null
      if (image) {
        const problem = checkImage(image)
        if (problem) {
          setAddError(problem)
          return
        }
        try {
          const up = await uploadImage(shop.shopId, image)
          imagePath = up.path
          imageUrl = up.url
        } catch (err) {
          setAddError(err instanceof Error ? err.message : 'Upload failed.')
          return
        }
      }

      const rule = shop.rules.find((r) => r.category === f.category)
      const { error: insertError } = await supabase.from('items').insert({
        shop_id: shop.shopId, name: f.name.trim(), category: f.category,
        branch_id: f.branch_id || shop.branches[0]?.id, price_per_day: Number(f.price) || 0,
        deposit: Number(f.deposit) || rule?.deposit || 0,
        late_fee_per_day: rule?.late_fee_per_day ?? 0,
        inclusions: f.inclusions.trim() || null,
        size_info: f.sizes.trim() || null, buffer_days: rule?.buffer_days ?? 2, image_url: imageUrl,
      })
      if (insertError) {
        if (imagePath) {
          const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([imagePath])
          if (cleanupError) setAddError(`${insertError.message} Image cleanup failed: ${cleanupError.message}`)
          else setAddError(insertError.message)
        } else {
          setAddError(insertError.message)
        }
        return
      }

      await shop.reload()
      setF({ ...f, name: '', price: '', deposit: '', inclusions: '', sizes: '' })
      setImage(null)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to add item.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <Sub>Edit photo, price, deposit, branch and sizes. Text changes save when you leave a field. Photos save as soon as you pick a file.</Sub>
      {photoError && <p className="mb-3 text-xs text-cleaning">{photoError}</p>}
      <section className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[1100px]">
          <thead><tr className="h-14">
            {['Photo', 'Item', 'Type', 'Branch', 'Price/day', 'Deposit', 'Late fee/day', 'Inclusions', 'Sizes'].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((i) => {
              const img = imageOf(i)
              const busy = photoBusy === i.id
              return (
                <tr key={i.id} className="h-20">
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <div className="h-16 w-12 shrink-0 overflow-hidden bg-cell">
                        {img && <img src={img} alt={i.name} className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex flex-col gap-1 text-[10px]">
                        <label className="cursor-pointer font-semibold underline">
                          {busy ? 'Uploading…' : img ? 'Change' : 'Add photo'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => { changePhoto(i, e.target.files?.[0]); e.target.value = '' }}
                          />
                        </label>
                        {img && !busy && (
                          <button type="button" className="text-left text-cleaning underline" onClick={() => removePhoto(i)}>Remove</button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`${td} font-semibold`}>{i.name}</td>
                  <td className={td}>
                    <select className={`${input} h-8`} value={i.category ?? ''} onChange={(e) => save(i.id, { category: e.target.value })}>
                      <option value="">-</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className={td}>
                    <select className={`${input} h-8`} value={i.branch_id ?? ''} onChange={(e) => save(i.id, { branch_id: e.target.value })}>
                      {shop.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  {(['price_per_day', 'deposit', 'late_fee_per_day'] as const).map((k) => (
                    <td key={k} className={td}>
                      <input type="number" min={0} className={`${input} h-8 w-24`} key={`${k}${i.id}${i[k]}`}
                        defaultValue={i[k] ?? 0} onBlur={(e) => save(i.id, { [k]: num(e) })} />
                    </td>
                  ))}
                  <td className={td}>
                    <input className={`${input} h-8`} placeholder="e.g. Gown, Petticoat" key={`inc${i.id}${i.inclusions}`}
                      defaultValue={i.inclusions ?? ''} onBlur={(e) => save(i.id, { inclusions: e.target.value || null })} />
                  </td>
                  <td className={td}>
                    <textarea className={`${input} h-10 min-w-[180px] resize-none`} rows={2} placeholder="e.g. Free size: 70 - 98 cm"
                      key={`size${i.id}${sizeOf(i)}`} defaultValue={sizeOf(i)}
                      onBlur={(e) => save(i.id, { size_info: e.target.value.trim() || null })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="pt-3 text-xs text-ink/60">No items yet.</p>}
      </section>

      <section className={card}>
        <h3 className="mb-4 text-xl font-bold">Add an item</h3>
        <form onSubmit={add} className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          <input className={`${input} col-span-2`} placeholder="Item name" required value={f.name} onChange={(e) => set('name', e.target.value)} />
          <select className={input} value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className={input} value={f.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
            {shop.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="number" min={0} className={input} placeholder="Price/day" value={f.price} onChange={(e) => set('price', e.target.value)} />
          <input type="number" min={0} className={input} placeholder="Deposit" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} />
          <input className={`${input} col-span-2`} placeholder="Inclusions (comma separated)" value={f.inclusions} onChange={(e) => set('inclusions', e.target.value)} />
          <textarea className={`${input} col-span-2 sm:col-span-4`} rows={3}
            placeholder={'Sizes (one per line), e.g.\nBust: 93 cm / 37 in\nWaist: 73 cm / 29 in'}
            value={f.sizes} onChange={(e) => set('sizes', e.target.value)} />
          <div className="col-span-2 flex items-center gap-4 sm:col-span-4">
            <div className="h-24 w-[72px] shrink-0 overflow-hidden bg-cell">
              {preview && <img src={preview} alt="Preview" className="h-full w-full object-cover" />}
            </div>
            <label className="text-xs">
              Item photo (optional, max {MAX_MB} MB)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              {image && (
                <button type="button" className="mt-1 text-[10px] underline" onClick={() => setImage(null)}>Clear photo</button>
              )}
            </label>
          </div>
          {addError && <p className="col-span-2 text-xs text-cleaning sm:col-span-4">{addError}</p>}
          <div className="col-span-2 sm:col-span-4">
            <button className={btn} type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add item'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}