'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Activity, Category, DEFAULT_COLORS } from '@/lib/supabase'

const ADMIN_KEY = 'cal_dm_admin_auth'
const ADMIN_PASS = 'DM2026'

const EMPTY_FORM = { category_slug: '', name: '', start_date: '', end_date: '', location: '', vendedor: '', dictante: '' }

// ── CSV Parser ────────────────────────────────────────────────
const MONTH_MAP: Record<string, number> = { ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,OCT:10,NOV:11,DIC:12 }
const PREFIX_TO_SLUG: Record<string, string> = {
  'CURSO': 'curso_externo', 'CONGRESO': 'congreso', 'JORNADA': 'jornada',
  'JORNADAS': 'jornada', 'MÓDULOS': 'modulos', 'MODULOS': 'modulos',
  'SIMPOSIO': 'simposio', 'VIAJE': 'viaje',
}

function parseDateRange(raw: string, year: number, month: number): { start: string; end: string } | null {
  const clean = raw.trim().replace(/\s+/g, ' ')
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: number, m: number, y: number) => `${y}-${pad(m)}-${pad(d)}`

  // "1 y 2", "11 y 12"
  let m = clean.match(/^(\d+)\s*y\s*(\d+)$/)
  if (m) return { start: fmt(+m[1], month, year), end: fmt(+m[2], month, year) }

  // "8 al 11", "26 al 28"
  m = clean.match(/^(\d+)\s*al\s*(\d+)$/)
  if (m) return { start: fmt(+m[1], month, year), end: fmt(+m[2], month, year) }

  // "20-21", "28-29"
  m = clean.match(/^(\d+)-(\d+)$/)
  if (m) return { start: fmt(+m[1], month, year), end: fmt(+m[2], month, year) }

  // single "11", "23"
  m = clean.match(/^(\d+)$/)
  if (m) return { start: fmt(+m[1], month, year), end: fmt(+m[1], month, year) }

  // "x def" or similar
  return null
}

function detectCategory(rawName: string, dmtLocations: string[]): { slug: string; name: string } {
  const upper = rawName.toUpperCase()
  for (const [prefix, slug] of Object.entries(PREFIX_TO_SLUG)) {
    if (upper.startsWith(prefix + ':') || upper === prefix) {
      // Check if DMT location → curso_dm
      if (slug === 'curso_externo' && dmtLocations.some(l => rawName.toUpperCase().includes(l.toUpperCase()))) {
        return { slug: 'curso_dm', name: rawName.replace(/^[^:]+:\s*/, '').trim() }
      }
      return { slug, name: rawName.replace(/^[^:]+:\s*/, '').trim() }
    }
  }
  return { slug: 'curso_externo', name: rawName.trim() }
}

function parseCSV(text: string, startFromJune: boolean): Omit<Activity, 'id' | 'created_at'>[] {
  const DMT_MARKERS = ['DMT', 'Dental Medrano Training', 'DM Training']
  const lines = text.split('\n')
  const results: Omit<Activity, 'id' | 'created_at'>[] = []

  let currentMonth = 0
  let currentYear = 2026

  // Find header row index
  let dataStart = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('EVENTO') && lines[i].toUpperCase().includes('FECHA')) { dataStart = i + 1; break }
  }

  const TARGET_MONTHS = startFromJune ? [6,7,8,9,10,11,12] : [1,2,3,4,5,6,7,8,9,10,11,12]

  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split(',')
    // cols[0] unused, cols[1] = month, cols[2] = evento, cols[3] = fecha, cols[4] = dictante, cols[5] = lugar

    const monthCell = (cols[1] || '').trim().toUpperCase()
    if (monthCell && MONTH_MAP[monthCell]) currentMonth = MONTH_MAP[monthCell]

    if (!TARGET_MONTHS.includes(currentMonth)) continue

    const rawName = (cols[2] || '').trim()
    const rawDate = (cols[3] || '').trim()
    const dictante = (cols[4] || '').trim()
    const location = (cols[5] || '').trim().replace(/"/g, '')

    if (!rawName || !rawDate) continue
    if (rawDate.toLowerCase().includes('x def')) continue

    const dates = parseDateRange(rawDate, currentYear, currentMonth)
    if (!dates) continue

    const { slug, name } = detectCategory(rawName, DMT_MARKERS)
    // Override: if location contains DMT markers and is curso_externo → curso_dm
    const finalSlug = (slug === 'curso_externo' && DMT_MARKERS.some(m => location.toUpperCase().includes(m.toUpperCase()))) ? 'curso_dm' : slug

    if (!name) continue

    results.push({
      type: finalSlug,
      category_slug: finalSlug,
      name,
      start_date: dates.start,
      end_date: dates.end,
      location: location || '',
      vendedor: '',
      dictante: dictante || '',
    })
  }

  return results
}

// ── Main Component ────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [tab, setTab] = useState<'actividades' | 'categorias' | 'importar'>('actividades')

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<Omit<Activity, 'id' | 'created_at'>[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvDone, setCsvDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Category edit state
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#f15922')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(ADMIN_KEY) === 'true') setAuthed(true)
  }, [])

  useEffect(() => { if (authed) fetchAll() }, [authed])

  async function fetchAll() {
    setLoading(true)
    const [{ data: acts }, { data: cats }] = await Promise.all([
      supabase.from('cal_activities').select('*').order('start_date'),
      supabase.from('cal_categories').select('*').order('sort_order'),
    ])
    setActivities(acts || [])
    setCategories(cats || [])
    if (!(acts || []).length || !form.category_slug) {
      const firstCat = (cats || [])[0]
      if (firstCat) setForm(f => ({ ...f, category_slug: firstCat.slug }))
    }
    setLoading(false)
  }

  function handleLogin() {
    if (pass === ADMIN_PASS) { localStorage.setItem(ADMIN_KEY, 'true'); setAuthed(true) }
    else { setPassError(true); setTimeout(() => setPassError(false), 2000) }
  }

  function handleLogout() { localStorage.removeItem(ADMIN_KEY); setAuthed(false) }

  function startEdit(act: Activity) {
    setForm({ category_slug: act.category_slug || act.type, name: act.name, start_date: act.start_date, end_date: act.end_date, location: act.location, vendedor: act.vendedor, dictante: act.dictante || '' })
    setEditId(act.id); setShowForm(true); setTab('actividades')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setForm({ ...EMPTY_FORM, category_slug: categories[0]?.slug || '' }); setEditId(null); setShowForm(false) }

  async function handleSave() {
    if (!form.name || !form.start_date || !form.end_date || !form.category_slug) return
    setSaving(true)
    const payload = { type: form.category_slug, category_slug: form.category_slug, name: form.name, start_date: form.start_date, end_date: form.end_date, location: form.location, vendedor: form.vendedor, dictante: form.dictante || null }
    if (editId) await supabase.from('cal_activities').update(payload).eq('id', editId)
    else await supabase.from('cal_activities').insert(payload)
    await fetchAll(); resetForm(); setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('cal_activities').delete().eq('id', id)
    setDeleteConfirm(null); await fetchAll()
  }

  // Category actions
  async function saveCatEdit() {
    if (!editCat) return
    setSavingCat(true)
    await supabase.from('cal_categories').update({ name: editCat.name, color: editCat.color }).eq('id', editCat.id)
    setEditCat(null); await fetchAll(); setSavingCat(false)
  }

  async function saveNewCat() {
    if (!newCatName || !newCatSlug) return
    setSavingCat(true)
    await supabase.from('cal_categories').insert({ slug: newCatSlug, name: newCatName, color: newCatColor, is_default: false, sort_order: categories.length })
    setShowNewCat(false); setNewCatName(''); setNewCatSlug(''); setNewCatColor('#f15922')
    await fetchAll(); setSavingCat(false)
  }

  // CSV import
  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text, true)
      setCsvPreview(parsed)
      setCsvDone(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function importCSV() {
    if (!csvPreview.length) return
    setCsvImporting(true)
    const chunks = []
    for (let i = 0; i < csvPreview.length; i += 50) chunks.push(csvPreview.slice(i, i + 50))
    for (const chunk of chunks) await supabase.from('cal_activities').insert(chunk)
    setCsvImporting(false); setCsvDone(true)
    await fetchAll()
  }

  const catMap = Object.fromEntries(categories.map(c => [c.slug, c]))
  const filtered = filter === 'all' ? activities : activities.filter(a => (a.category_slug || a.type) === filter)

  const inp = { background: '#181818', border: '1px solid #252525', borderRadius: 8, color: '#f0f0f0', padding: '10px 12px', fontSize: 14, fontFamily: 'Barlow, sans-serif', width: '100%', outline: 'none' }
  const lbl = { fontSize: 10, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: 1.5, color: '#555', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: 16 }}>
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 20, padding: 40, width: '100%', maxWidth: 360 }}>
        <div style={{ width: 40, height: 40, background: '#f15922', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, fontFamily: 'Montserrat' }}>DM</span>
        </div>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: '#f0f0f0', marginBottom: 6 }}>Calendario DM</h1>
        <p style={{ color: '#555', fontSize: 13, fontFamily: 'Barlow', marginBottom: 28 }}>Panel de administración</p>
        <label style={lbl}>Contraseña</label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••" style={{ ...inp, border: passError ? '1px solid #f15922' : '1px solid #252525', marginBottom: passError ? 4 : 20 }} autoFocus />
        {passError && <p style={{ color: '#f15922', fontSize: 12, marginBottom: 16, fontFamily: 'Barlow' }}>Contraseña incorrecta</p>}
        <button onClick={handleLogin} style={{ width: '100%', background: '#f15922', border: 'none', borderRadius: 10, color: '#fff', padding: '13px', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer' }}>Ingresar</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Header */}
      <header style={{ background: '#0f0f0f', borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, background: '#f15922', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 900, fontFamily: 'Montserrat' }}>DM</span>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#f15922', fontFamily: 'Barlow Condensed', letterSpacing: 2, textTransform: 'uppercase' }}>Admin</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: '#f0f0f0', lineHeight: 1 }}>Calendario DM</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/" target="_blank" style={{ background: '#181818', border: '1px solid #252525', color: '#666', padding: '7px 14px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>Ver ↗</a>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #222', color: '#555', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed' }}>Salir</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1a1a1a', background: '#0f0f0f', padding: '0 24px' }}>
        {(['actividades', 'categorias', 'importar'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #f15922' : '2px solid transparent', color: tab === t ? '#f0f0f0' : '#555', padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'Barlow Condensed', letterSpacing: 1, textTransform: 'uppercase', marginBottom: -1 }}>
            {t === 'actividades' ? `Actividades (${activities.length})` : t === 'categorias' ? 'Categorías' : 'Importar CSV'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px' }}>

        {/* ── TAB: ACTIVIDADES ── */}
        {tab === 'actividades' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...EMPTY_FORM, category_slug: categories[0]?.slug || '' }) }}
                style={{ background: showForm ? '#222' : '#f15922', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer' }}>
                {showForm ? '✕ Cancelar' : '+ Nueva actividad'}
              </button>
            </div>

            {showForm && (
              <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, marginBottom: 28 }}>
                <h2 style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 20 }}>{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>

                {/* Category selector */}
                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>Tipo / Categoría</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {categories.map(cat => (
                      <button key={cat.slug} onClick={() => setForm(f => ({ ...f, category_slug: cat.slug }))}
                        style={{ background: form.category_slug === cat.slug ? `${cat.color}22` : '#181818', border: `1px solid ${form.category_slug === cat.slug ? cat.color : '#252525'}`, borderRadius: 20, color: form.category_slug === cat.slug ? cat.color : '#666', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Nombre</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la actividad" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Fecha inicio</label>
                    <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Fecha fin</label>
                    <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Lugar</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Lugar del evento" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Vendedor</label>
                    <input value={form.vendedor} onChange={e => setForm(f => ({ ...f, vendedor: e.target.value }))} placeholder="Nombre del vendedor" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Dictante</label>
                    <input value={form.dictante} onChange={e => setForm(f => ({ ...f, dictante: e.target.value }))} placeholder="Nombre del dictante" style={inp} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={resetForm} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#666', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Barlow' }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving || !form.name || !form.start_date || !form.end_date || !form.category_slug}
                    style={{ background: '#f15922', border: 'none', color: '#fff', padding: '9px 22px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat', opacity: (saving || !form.name || !form.start_date || !form.end_date || !form.category_slug) ? 0.4 : 1 }}>
                    {saving ? 'Guardando...' : editId ? 'Guardar' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}

            {/* Filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? '#f15922' : '#181818', border: `1px solid ${filter === 'all' ? '#f15922' : '#252525'}`, color: filter === 'all' ? '#fff' : '#666', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>Todas</button>
              {categories.map(cat => (
                <button key={cat.slug} onClick={() => setFilter(cat.slug)} style={{ background: filter === cat.slug ? `${cat.color}22` : '#181818', border: `1px solid ${filter === cat.slug ? cat.color : '#252525'}`, color: filter === cat.slug ? cat.color : '#666', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{cat.name}</button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: '#444', padding: 40, fontFamily: 'Barlow Condensed' }}>Cargando...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#333', padding: 60, fontFamily: 'Barlow Condensed', fontSize: 14 }}>No hay actividades</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(act => {
                  const cat = catMap[act.category_slug] || catMap[act.type] || { color: '#666', name: act.category_slug }
                  return (
                    <div key={act.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderLeft: `3px solid ${cat.color}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: cat.color, fontFamily: 'Barlow Condensed', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{cat.name}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', fontFamily: 'Montserrat', marginBottom: 3 }}>{act.name}</div>
                        <div style={{ fontSize: 11, color: '#444', fontFamily: 'Barlow' }}>
                          {act.start_date === act.end_date ? act.start_date : `${act.start_date} → ${act.end_date}`}
                          {act.location ? ` · ${act.location}` : ''}
                          {act.vendedor ? ` · ${act.vendedor}` : ''}
                          {act.dictante ? ` · ${act.dictante}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button onClick={() => startEdit(act)} style={{ background: '#181818', border: '1px solid #252525', color: '#666', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✏</button>
                        {deleteConfirm === act.id
                          ? <button onClick={() => handleDelete(act.id)} style={{ background: '#450a0a', border: 'none', color: '#f87171', padding: '0 10px', height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Barlow Condensed' }}>Borrar</button>
                          : <button onClick={() => setDeleteConfirm(act.id)} style={{ background: '#181818', border: '1px solid #252525', color: '#666', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🗑</button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB: CATEGORÍAS ── */}
        {tab === 'categorias' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => setShowNewCat(!showNewCat)} style={{ background: showNewCat ? '#222' : '#f15922', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer' }}>
                {showNewCat ? '✕ Cancelar' : '+ Nueva categoría'}
              </button>
            </div>

            {showNewCat && (
              <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 18 }}>Nueva categoría</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Nombre</label>
                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="ej: Evento especial" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Slug (sin espacios)</label>
                    <input value={newCatSlug} onChange={e => setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="ej: evento_especial" style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={lbl}>Color</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {DEFAULT_COLORS.map(c => (
                      <button key={c} onClick={() => setNewCatColor(c)} style={{ width: 28, height: 28, borderRadius: 7, background: c, border: newCatColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                    ))}
                  </div>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowNewCat(false)} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#666', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                  <button onClick={saveNewCat} disabled={savingCat || !newCatName || !newCatSlug} style={{ background: '#f15922', border: 'none', color: '#fff', padding: '9px 22px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat', opacity: (!newCatName || !newCatSlug) ? 0.4 : 1 }}>
                    {savingCat ? 'Guardando...' : 'Crear'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderLeft: `3px solid ${cat.color}`, borderRadius: 10, padding: '14px 16px' }}>
                  {editCat?.id === cat.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                        <div>
                          <label style={lbl}>Nombre</label>
                          <input value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} style={inp} />
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Color</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {DEFAULT_COLORS.map(c => (
                            <button key={c} onClick={() => setEditCat({ ...editCat, color: c })} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: editCat.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                          ))}
                        </div>
                        <input type="color" value={editCat.color} onChange={e => setEditCat({ ...editCat, color: e.target.value })} style={{ width: 36, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditCat(null)} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#666', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                        <button onClick={saveCatEdit} disabled={savingCat} style={{ background: '#f15922', border: 'none', color: '#fff', padding: '7px 18px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat' }}>
                          {savingCat ? '...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: cat.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', fontFamily: 'Montserrat' }}>{cat.name}</div>
                        <div style={{ fontSize: 11, color: '#444', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{cat.slug} · {cat.color}</div>
                      </div>
                      <button onClick={() => setEditCat(cat)} style={{ background: '#181818', border: '1px solid #252525', color: '#666', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed' }}>Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB: IMPORTAR CSV ── */}
        {tab === 'importar' && (
          <>
            <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 28, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Importar desde CSV</h2>
              <p style={{ fontSize: 13, color: '#555', fontFamily: 'Barlow', marginBottom: 24, lineHeight: 1.5 }}>
                Cargá el CSV exportado del Sheet. El sistema detecta automáticamente el tipo por el prefijo (CURSO:, CONGRESO:, etc.) y reconoce si el lugar es DMT para clasificarlo como Curso DM Training. Solo importa desde junio en adelante.
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: '1.5px dashed #2a2a2a', borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, background: '#0f0f0f' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#f15922')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, color: '#555', fontFamily: 'Barlow' }}>Hacé click para seleccionar el CSV</div>
                <div style={{ fontSize: 11, color: '#333', fontFamily: 'Barlow Condensed', marginTop: 4, letterSpacing: 0.5 }}>Exportá el Sheet como CSV (Archivo → Descargar → CSV)</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileLoad} />

              {csvPreview.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#888', fontFamily: 'Barlow' }}>
                      <span style={{ color: '#f15922', fontWeight: 700 }}>{csvPreview.length}</span> actividades detectadas
                    </div>
                    <button onClick={importCSV} disabled={csvImporting || csvDone}
                      style={{ background: csvDone ? '#052e16' : '#f15922', border: 'none', color: csvDone ? '#4ade80' : '#fff', padding: '9px 20px', borderRadius: 8, cursor: csvDone ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat', opacity: csvImporting ? 0.6 : 1 }}>
                      {csvDone ? '✓ Importado' : csvImporting ? 'Importando...' : 'Importar todo'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
                    {csvPreview.map((act, i) => {
                      const cat = catMap[act.category_slug] || { color: '#666', name: act.category_slug }
                      return (
                        <div key={i} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderLeft: `2px solid ${cat.color}`, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: cat.color, fontFamily: 'Barlow Condensed', letterSpacing: 1, minWidth: 90, textTransform: 'uppercase' }}>{cat.name}</span>
                            <span style={{ fontSize: 12, color: '#d0d0d0', fontFamily: 'Barlow', flex: 1 }}>{act.name}</span>
                            <span style={{ fontSize: 11, color: '#444', fontFamily: 'Barlow Condensed', flexShrink: 0 }}>{act.start_date}{act.end_date !== act.start_date ? ` → ${act.end_date}` : ''}</span>
                          </div>
                          {(act.location || act.dictante) && (
                            <div style={{ fontSize: 11, color: '#444', fontFamily: 'Barlow', marginTop: 3, paddingLeft: 100 }}>
                              {act.location}{act.dictante ? ` · ${act.dictante}` : ''}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
