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
  const [images, setImages] = useState<File[]>([])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [photoBusy, setPhotoBusy] = useState('') // id of the item whose photo is uploading
  const [photoError, setPhotoError] = useState('')
  const [photoToRemove, setPhotoToRemove] = useState<Item | null>(null)
  const list = shop.items.filter((i) => inBranch(branch, i.branches?.name))
  const save = (id: string, patch: object) => shop.act(supabase.from('items').update(patch).eq('id', id))
  const set = (k: string, v: string) => setF({ ...f, [k]: v })

  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images])
  useEffect(() => () => { previews.forEach((url) => URL.revokeObjectURL(url)) }, [previews])

  // Add one or more photos to an existing item.
  async function changePhotos(item: Item, files: File[]) {
    if (!files.length) return
    setPhotoBusy(item.id)
    setPhotoError('')

    const existing = ((item as Item & { image_urls?: string[] | null }).image_urls?.length
      ? (item as Item & { image_urls?: string[] | null }).image_urls
      : (imageOf(item) ? [imageOf(item)!] : [])) ?? []

    if (existing.length + files.length > 2) {
      setPhotoError(`This item already has ${existing.length} photo${existing.length === 1 ? '' : 's'}. A maximum of 2 photos is allowed.`)
      setPhotoBusy('')
      return
    }

    const uploaded: { path: string; url: string }[] = []
    try {
      for (const file of files) {
        const problem = checkImage(file)
        if (problem) throw new Error(problem)
        uploaded.push(await uploadImage(shop.shopId, file))
      }

      const next = [...existing, ...uploaded.map((photo) => photo.url)].slice(0, 2)
      let { error } = await supabase.from('items').update({ image_url: next[0], image_urls: next }).eq('id', item.id)
      if (error?.message.includes('image_urls')) {
        const fallback = await supabase.from('items').update({ image_url: next[0] }).eq('id', item.id)
        error = fallback.error
      }
      if (error) throw new Error(error.message)

      await shop.reload()
    } catch (e) {
      if (uploaded.length) {
        await supabase.storage.from(BUCKET).remove(uploaded.map((photo) => photo.path))
      }
      setPhotoError(e instanceof Error ? e.message : 'Unable to change photos.')
    } finally {
      setPhotoBusy('')
    }
  }

  async function removePhoto(item: Item) {
    setPhotoBusy(item.id)
    setPhotoError('')
    const existing = ((item as Item & { image_urls?: string[] | null }).image_urls?.length
      ? (item as Item & { image_urls?: string[] | null }).image_urls
      : (imageOf(item) ? [imageOf(item)!] : [])) ?? []
    const next = existing.slice(1)
    let { error } = await supabase.from('items').update({ image_url: next[0] ?? null, image_urls: next }).eq('id', item.id)
    if (error?.message.includes('image_urls')) {
      const fallback = await supabase.from('items').update({ image_url: next[0] ?? null }).eq('id', item.id)
      error = fallback.error
    }
    if (error) setPhotoError(error.message)
    else {
      const oldPath = pathFromUrl(imageOf(item))
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
      await shop.reload()
    }
    setPhotoBusy('')
    setPhotoToRemove(null)
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    let imagePath: string | null = null
    try {
      let imageUrl: string | null = null
      const uploadedGallery: string[] = []
      if (images.length > 2) {
        setAddError('Choose no more than 2 photos.')
        return
      }
      for (const image of images) {
        const problem = checkImage(image)
        if (problem) {
          setAddError(problem)
          return
        }
        try {
          const up = await uploadImage(shop.shopId, image)
          uploadedGallery.push(up.url)
          if (!imagePath) imagePath = up.path
        } catch (err) {
          setAddError(err instanceof Error ? err.message : 'Upload failed.')
          return
        }
      }
      imageUrl = uploadedGallery[0] ?? null

      const rule = shop.rules.find((r) => r.category === f.category)
      let insertQuery = supabase.from('items').insert({
        shop_id: shop.shopId, name: f.name.trim(), category: f.category,
        branch_id: f.branch_id || shop.branches[0]?.id, price_per_day: Number(f.price) || 0,
        deposit: Number(f.deposit) || rule?.deposit || 0,
        late_fee_per_day: rule?.late_fee_per_day ?? 0,
        inclusions: f.inclusions.trim() || null,
        size_info: f.sizes.trim() || null, buffer_days: rule?.buffer_days ?? 2,
        image_url: imageUrl, image_urls: uploadedGallery,
      })
      let { error: insertError } = await insertQuery
      if (insertError?.message.includes('image_urls')) {
        const fallbackInsert = await supabase.from('items').insert({
          shop_id: shop.shopId, name: f.name.trim(), category: f.category,
          branch_id: f.branch_id || shop.branches[0]?.id, price_per_day: Number(f.price) || 0,
          deposit: Number(f.deposit) || rule?.deposit || 0,
          late_fee_per_day: rule?.late_fee_per_day ?? 0,
          inclusions: f.inclusions.trim() || null,
          size_info: f.sizes.trim() || null, buffer_days: rule?.buffer_days ?? 2,
          image_url: imageUrl,
        })
        insertError = fallbackInsert.error
      }
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
      console.log('Saved item image gallery:', uploadedGallery)
      setF({ ...f, name: '', price: '', deposit: '', inclusions: '', sizes: '' })
      setImages([])
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to add item.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <Sub>Edit photo, price, deposit, branch and sizes. Text changes save when you leave a field. Photos save as soon as you pick a file.</Sub>
      {photoError && <p className="mb-3 text-sm text-cleaning">{photoError}</p>}
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
                <tr key={i.id} className="h-24">
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <div className="h-20 w-16 shrink-0 overflow-hidden bg-cell">
                        {img && <img src={img} alt={i.name} className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        <label className="cursor-pointer font-semibold underline">
                          {busy ? 'Uploading…' : img ? 'Change' : 'Add photo'}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => { changePhotos(i, Array.from(e.target.files ?? []).slice(0, 2)); e.target.value = '' }}
                          />
                        </label>
                        {img && !busy && (
                          <button type="button" className="text-left text-cleaning underline" onClick={() => setPhotoToRemove(i)}>Remove</button>
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
        {list.length === 0 && <p className="pt-3 text-sm text-ink/60">No items yet.</p>}
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
            <div className="flex h-48 gap-2 overflow-x-auto">
              {previews.map((preview) => (
                <div key={preview} className="h-48 w-36 shrink-0 overflow-hidden bg-cell">
                  <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <label className="text-sm">
              Item photos (optional, 1-2 photos, max {MAX_MB} MB each)
              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-1 block w-full text-sm"
                onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 2))}
              />
              {images.length > 0 && (
                <button type="button" className="mt-1 text-sm underline" onClick={() => setImages([])}>Clear photos</button>
              )}
            </label>
          </div>
          {addError && <p className="col-span-2 text-sm text-cleaning sm:col-span-4">{addError}</p>}
          <div className="col-span-2 sm:col-span-4">
            <button className={btn} type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add item'}</button>
          </div>
        </form>
      </section>

      {photoToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setPhotoToRemove(null)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="remove-photo-title"
            className="w-full max-w-md rounded-sm bg-white p-6 shadow-lg">
            <h2 id="remove-photo-title" className="text-xl font-bold">Remove photo?</h2>
            <p className="mt-2 text-sm text-ink/70">
              Remove the photo of <span className="font-semibold text-ink">{photoToRemove.name}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-sm border border-ink/20 px-4 py-2 text-sm font-semibold"
                onClick={() => setPhotoToRemove(null)} disabled={photoBusy === photoToRemove.id}>
                Cancel
              </button>
              <button type="button" className="rounded-sm bg-cleaning px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => removePhoto(photoToRemove)} disabled={photoBusy === photoToRemove.id}>
                {photoBusy === photoToRemove.id ? 'Removing…' : 'Remove photo'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}