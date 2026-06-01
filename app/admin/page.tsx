'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Activity, Category, DEFAULT_COLORS } from '@/lib/supabase'

const ADMIN_KEY = 'cal_dm_admin_auth'
const ADMIN_PASS = 'DM2026'
const EMPTY_FORM = { category_slug: '', name: '', start_date: '', end_date: '', location: '', vendedor: '', dictante: '' }

const MONTH_MAP: Record<string, number> = { ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,OCT:10,NOV:11,DIC:12 }
const PREFIX_TO_SLUG: Record<string, string> = {
  'CURSO':'curso_externo','CONGRESO':'congreso','JORNADA':'jornada','JORNADAS':'jornada',
  'MÓDULOS':'modulos','MODULOS':'modulos','SIMPOSIO':'simposio','VIAJE':'viaje',
}
const DMT_MARKERS = ['DMT','Dental Medrano Training','DM Training']

function parseDateRange(raw: string, year: number, month: number) {
  const clean = raw.trim().replace(/\s+/g,' ')
  const pad = (n: number) => String(n).padStart(2,'0')
  const fmt = (d: number, m: number, y: number) => `${y}-${pad(m)}-${pad(d)}`
  let r = clean.match(/^(\d+)\s*y\s*(\d+)$/)
  if (r) return { start: fmt(+r[1],month,year), end: fmt(+r[2],month,year) }
  r = clean.match(/^(\d+)\s*al\s*(\d+)$/)
  if (r) return { start: fmt(+r[1],month,year), end: fmt(+r[2],month,year) }
  r = clean.match(/^(\d+)-(\d+)$/)
  if (r) return { start: fmt(+r[1],month,year), end: fmt(+r[2],month,year) }
  r = clean.match(/^(\d+)$/)
  if (r) return { start: fmt(+r[1],month,year), end: fmt(+r[1],month,year) }
  return null
}

function parseCSV(text: string): Omit<Activity,'id'|'created_at'>[] {
  const lines = text.split('\n')
  const results: Omit<Activity,'id'|'created_at'>[] = []
  let currentMonth = 0
  let dataStart = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('EVENTO') && lines[i].toUpperCase().includes('FECHA')) { dataStart = i+1; break }
  }
  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const monthCell = (cols[1]||'').trim().toUpperCase()
    if (monthCell && MONTH_MAP[monthCell]) currentMonth = MONTH_MAP[monthCell]
    if (currentMonth < 6) continue
    const rawName = (cols[2]||'').trim()
    const rawDate = (cols[3]||'').trim()
    const dictante = (cols[4]||'').trim()
    const location = (cols[5]||'').trim().replace(/"/g,'')
    if (!rawName || !rawDate || rawDate.toLowerCase().includes('x def')) continue
    const dates = parseDateRange(rawDate, 2026, currentMonth)
    if (!dates) continue
    const upper = rawName.toUpperCase()
    let slug = 'curso_externo'
    let name = rawName
    for (const [prefix, s] of Object.entries(PREFIX_TO_SLUG)) {
      if (upper.startsWith(prefix+':') || upper === prefix) {
        slug = s; name = rawName.replace(/^[^:]+:\s*/,'').trim(); break
      }
    }
    if (slug === 'curso_externo' && DMT_MARKERS.some(m => location.toUpperCase().includes(m.toUpperCase()))) slug = 'curso_dm'
    if (!name) continue
    results.push({ type: slug, category_slug: slug, name, start_date: dates.start, end_date: dates.end, location: location||'', vendedor:'', dictante: dictante||'' })
  }
  return results
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState<'actividades'|'categorias'|'importar'>('actividades')
  const [csvPreview, setCsvPreview] = useState<Omit<Activity,'id'|'created_at'>[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvDone, setCsvDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editCat, setEditCat] = useState<Category|null>(null)
  const [newCat, setNewCat] = useState({ name:'', slug:'', color:'#f15922' })
  const [showNewCat, setShowNewCat] = useState(false)
  const [savingCat, setSavingCat] = useState(false)

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
    setActivities(acts||[])
    setCategories(cats||[])
    if (!form.category_slug && (cats||[]).length > 0) setForm(f => ({ ...f, category_slug: cats![0].slug }))
    setLoading(false)
  }

  function handleLogin() {
    if (pass === ADMIN_PASS) { localStorage.setItem(ADMIN_KEY,'true'); setAuthed(true) }
    else { setPassError(true); setTimeout(() => setPassError(false), 2000) }
  }
  function handleLogout() { localStorage.removeItem(ADMIN_KEY); setAuthed(false) }

  function startEdit(act: Activity) {
    setForm({ category_slug: act.category_slug||act.type, name: act.name, start_date: act.start_date, end_date: act.end_date, location: act.location, vendedor: act.vendedor, dictante: act.dictante||'' })
    setEditId(act.id); setShowForm(true); setTab('actividades')
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  function resetForm() { setForm({ ...EMPTY_FORM, category_slug: categories[0]?.slug||'' }); setEditId(null); setShowForm(false) }

  async function handleSave() {
    const isViaje = form.category_slug === 'viaje'
    const autoName = isViaje ? `${form.vendedor} - ${form.location}` : form.name
    if (!autoName||!form.start_date||!form.end_date||!form.category_slug) return
    if (isViaje && (!form.vendedor||!form.location)) return
    setSaving(true)
    const payload = { type: form.category_slug, category_slug: form.category_slug, name: autoName, start_date: form.start_date, end_date: form.end_date, location: form.location, vendedor: form.vendedor, dictante: form.dictante||null }
    if (editId) await supabase.from('cal_activities').update(payload).eq('id',editId)
    else await supabase.from('cal_activities').insert(payload)
    await fetchAll(); resetForm(); setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('cal_activities').delete().eq('id',id)
    setDeleteConfirm(null); await fetchAll()
  }

  async function saveCatEdit() {
    if (!editCat) return
    setSavingCat(true)
    await supabase.from('cal_categories').update({ name: editCat.name, color: editCat.color }).eq('id',editCat.id)
    setEditCat(null); await fetchAll(); setSavingCat(false)
  }

  async function saveNewCat() {
    if (!newCat.name||!newCat.slug) return
    setSavingCat(true)
    await supabase.from('cal_categories').insert({ slug: newCat.slug, name: newCat.name, color: newCat.color, is_default: false, sort_order: categories.length })
    setShowNewCat(false); setNewCat({ name:'', slug:'', color:'#f15922' }); await fetchAll(); setSavingCat(false)
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCsvPreview(parseCSV(ev.target?.result as string)); setCsvDone(false) }
    reader.readAsText(file, 'UTF-8')
  }

  async function importCSV() {
    if (!csvPreview.length) return
    setCsvImporting(true)
    for (let i = 0; i < csvPreview.length; i += 50) await supabase.from('cal_activities').insert(csvPreview.slice(i,i+50))
    setCsvImporting(false); setCsvDone(true); await fetchAll()
  }

  const catMap = Object.fromEntries(categories.map(c => [c.slug,c]))
  const filtered = filter === 'all' ? activities : activities.filter(a => (a.category_slug||a.type) === filter)

  const inp = { background:'#f7f7f7', border:'1px solid #e0e0e0', borderRadius:8, color:'#111', padding:'10px 12px', fontSize:14, fontFamily:'Barlow, sans-serif', width:'100%', outline:'none' }
  const lbl = { fontSize:10, fontFamily:'Barlow Condensed, sans-serif', letterSpacing:1.5, color:'#999', textTransform:'uppercase' as const, marginBottom:5, display:'block', fontWeight:600 }

  if (!authed) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f5', padding:16 }}>
      <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:20, padding:40, width:'100%', maxWidth:360, boxShadow:'0 4px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ width:42, height:42, background:'#f15922', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          <span style={{ color:'#fff', fontSize:16, fontWeight:900, fontFamily:'Montserrat' }}>DM</span>
        </div>
        <h1 style={{ fontFamily:'Montserrat', fontSize:22, fontWeight:800, color:'#111', marginBottom:4 }}>Calendario DM</h1>
        <p style={{ color:'#aaa', fontSize:13, fontFamily:'Barlow', marginBottom:28 }}>Panel de administración</p>
        <label style={lbl}>Contraseña</label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==='Enter' && handleLogin()} placeholder="••••••" style={{ ...inp, border: passError ? '1px solid #f15922' : '1px solid #e0e0e0', marginBottom: passError ? 4 : 20 }} autoFocus />
        {passError && <p style={{ color:'#f15922', fontSize:12, marginBottom:16 }}>Contraseña incorrecta</p>}
        <button onClick={handleLogin} style={{ width:'100%', background:'#f15922', border:'none', borderRadius:10, color:'#fff', padding:'13px', fontSize:14, fontWeight:700, fontFamily:'Montserrat', cursor:'pointer' }}>Ingresar</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f5' }}>
      <header style={{ background:'#fff', borderBottom:'1px solid #e8e8e8', padding:'0 24px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, background:'#f15922', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#fff', fontSize:12, fontWeight:900, fontFamily:'Montserrat' }}>DM</span>
          </div>
          <div>
            <div style={{ fontSize:9, color:'#f15922', fontFamily:'Barlow Condensed', letterSpacing:2, textTransform:'uppercase', fontWeight:600 }}>Admin</div>
            <div style={{ fontFamily:'Montserrat', fontSize:15, fontWeight:800, color:'#111', lineHeight:1 }}>Calendario DM</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/" target="_blank" style={{ background:'#f5f5f5', border:'1px solid #e0e0e0', color:'#666', padding:'7px 14px', borderRadius:8, fontSize:12, textDecoration:'none', fontFamily:'Barlow Condensed', letterSpacing:1 }}>Ver ↗</a>
          <button onClick={handleLogout} style={{ background:'transparent', border:'1px solid #e0e0e0', color:'#999', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'Barlow Condensed' }}>Salir</button>
        </div>
      </header>

      <div style={{ display:'flex', gap:0, borderBottom:'1px solid #e8e8e8', background:'#fff', padding:'0 24px' }}>
        {(['actividades','categorias','importar'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:'none', border:'none', borderBottom: tab===t ? '2px solid #f15922' : '2px solid transparent', color: tab===t ? '#111' : '#aaa', padding:'12px 16px', cursor:'pointer', fontSize:12, fontFamily:'Barlow Condensed', letterSpacing:1, textTransform:'uppercase', marginBottom:-1, fontWeight: tab===t ? 700 : 400 }}>
            {t==='actividades' ? `Actividades (${activities.length})` : t==='categorias' ? 'Categorías' : 'Importar CSV'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 16px' }}>

        {/* ACTIVIDADES */}
        {tab==='actividades' && (
          <>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
              <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...EMPTY_FORM, category_slug: categories[0]?.slug||'' }) }}
                style={{ background: showForm ? '#f0f0f0' : '#f15922', border:'none', color: showForm ? '#666' : '#fff', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:700, fontFamily:'Montserrat', cursor:'pointer' }}>
                {showForm ? '✕ Cancelar' : '+ Nueva actividad'}
              </button>
            </div>

            {showForm && (
              <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:14, padding:24, marginBottom:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontFamily:'Montserrat', fontSize:15, fontWeight:700, color:'#111', marginBottom:18 }}>{editId ? 'Editar' : 'Nueva actividad'}</h2>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Categoría</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {categories.map(cat => (
                      <button key={cat.slug} onClick={() => setForm(f => ({ ...f, category_slug: cat.slug }))}
                        style={{ background: form.category_slug===cat.slug ? `${cat.color}15` : '#f7f7f7', border:`1px solid ${form.category_slug===cat.slug ? cat.color : '#e0e0e0'}`, borderRadius:20, color: form.category_slug===cat.slug ? cat.color : '#888', padding:'6px 14px', cursor:'pointer', fontSize:12, fontFamily:'Barlow Condensed', letterSpacing:0.5, display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const isViajeForm = form.category_slug === 'viaje'
                  const canSave = isViajeForm
                    ? (!!form.vendedor && !!form.location && !!form.start_date && !!form.end_date)
                    : (!!form.name && !!form.start_date && !!form.end_date)
                  return (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                        {/* Vendedor primero para viaje */}
                        <div style={{ gridColumn: isViajeForm ? '1 / 2' : '1 / -1' }}>
                          <label style={lbl}>Vendedor</label>
                          <input value={form.vendedor} onChange={e => setForm(f => ({ ...f, vendedor:e.target.value }))} placeholder="Nombre del vendedor" style={inp} />
                        </div>
                        {/* Destino para viaje (al lado del vendedor) */}
                        {isViajeForm && (
                          <div>
                            <label style={lbl}>Destino</label>
                            <input value={form.location} onChange={e => setForm(f => ({ ...f, location:e.target.value }))} placeholder="ej: Mar del Plata" style={inp} />
                          </div>
                        )}
                        {/* Nombre solo para no-viaje */}
                        {!isViajeForm && (
                          <div style={{ gridColumn:'1 / -1' }}>
                            <label style={lbl}>Nombre</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="Nombre de la actividad" style={inp} />
                          </div>
                        )}
                        <div>
                          <label style={lbl}>Fecha inicio</label>
                          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date:e.target.value, end_date:f.end_date||e.target.value }))} style={inp} />
                        </div>
                        <div>
                          <label style={lbl}>Fecha fin</label>
                          <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date:e.target.value }))} style={inp} />
                        </div>
                        {/* Lugar solo para no-viaje */}
                        {!isViajeForm && (
                          <div style={{ gridColumn:'1 / -1' }}>
                            <label style={lbl}>Lugar</label>
                            <input value={form.location} onChange={e => setForm(f => ({ ...f, location:e.target.value }))} placeholder="ej: Hotel Intersur, Buenos Aires" style={inp} />
                          </div>
                        )}
                        {!isViajeForm && (
                          <div>
                            <label style={lbl}>Dictante</label>
                            <input value={form.dictante} onChange={e => setForm(f => ({ ...f, dictante:e.target.value }))} placeholder="Nombre del dictante" style={inp} />
                          </div>
                        )}
                      </div>
                      {/* Preview para viaje */}
                      {isViajeForm && form.vendedor && form.location && (
                        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#16a34a', fontFamily:'Barlow Condensed', letterSpacing:0.5 }}>
                          ✈ Así va a aparecer: <strong>{form.vendedor} - {form.location}</strong>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button onClick={resetForm} style={{ background:'transparent', border:'1px solid #e0e0e0', color:'#999', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Cancelar</button>
                        <button onClick={handleSave} disabled={saving || !canSave}
                          style={{ background:'#f15922', border:'none', color:'#fff', padding:'9px 22px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'Montserrat', opacity: !canSave ? 0.4 : 1 }}>
                          {saving ? 'Guardando...' : editId ? 'Guardar' : 'Agregar'}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
              <button onClick={() => setFilter('all')} style={{ background: filter==='all' ? '#f15922' : '#fff', border:`1px solid ${filter==='all' ? '#f15922' : '#e0e0e0'}`, color: filter==='all' ? '#fff' : '#888', padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:11, fontFamily:'Barlow Condensed', letterSpacing:0.5, fontWeight:600 }}>Todas</button>
              {categories.map(cat => (
                <button key={cat.slug} onClick={() => setFilter(cat.slug)} style={{ background: filter===cat.slug ? `${cat.color}15` : '#fff', border:`1px solid ${filter===cat.slug ? cat.color : '#e0e0e0'}`, color: filter===cat.slug ? cat.color : '#888', padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:11, fontFamily:'Barlow Condensed', letterSpacing:0.5, fontWeight:600 }}>{cat.name}</button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign:'center', color:'#bbb', padding:40 }}>Cargando...</div>
            ) : filtered.length===0 ? (
              <div style={{ textAlign:'center', color:'#ccc', padding:60, fontFamily:'Barlow Condensed', fontSize:14 }}>No hay actividades</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {filtered.map(act => {
                  const cat = catMap[act.category_slug]||catMap[act.type]||{ color:'#888', name:act.category_slug }
                  return (
                    <div key={act.id} style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:`3px solid ${cat.color}`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, color:cat.color, fontFamily:'Barlow Condensed', letterSpacing:1, textTransform:'uppercase', marginBottom:3, fontWeight:700 }}>{cat.name}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#111', fontFamily:'Montserrat', marginBottom:3 }}>{act.name}</div>
                        <div style={{ fontSize:11, color:'#bbb', fontFamily:'Barlow' }}>
                          {act.start_date===act.end_date ? act.start_date : `${act.start_date} → ${act.end_date}`}
                          {act.location ? ` · ${act.location}` : ''}
                          {act.vendedor ? ` · ${act.vendedor}` : ''}
                          {act.dictante ? ` · ${act.dictante}` : ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                        <button onClick={() => startEdit(act)} style={{ background:'#f5f5f5', border:'1px solid #e8e8e8', color:'#888', width:30, height:30, borderRadius:6, cursor:'pointer', fontSize:12 }}>✏</button>
                        {deleteConfirm===act.id
                          ? <button onClick={() => handleDelete(act.id)} style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#ef4444', padding:'0 10px', height:30, borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'Barlow Condensed', fontWeight:700 }}>Borrar</button>
                          : <button onClick={() => setDeleteConfirm(act.id)} style={{ background:'#f5f5f5', border:'1px solid #e8e8e8', color:'#888', width:30, height:30, borderRadius:6, cursor:'pointer', fontSize:12 }}>🗑</button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* CATEGORÍAS */}
        {tab==='categorias' && (
          <>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
              <button onClick={() => setShowNewCat(!showNewCat)} style={{ background: showNewCat ? '#f0f0f0' : '#f15922', border:'none', color: showNewCat ? '#666' : '#fff', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:700, fontFamily:'Montserrat', cursor:'pointer' }}>
                {showNewCat ? '✕ Cancelar' : '+ Nueva categoría'}
              </button>
            </div>

            {showNewCat && (
              <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:14, padding:24, marginBottom:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontFamily:'Montserrat', fontSize:14, fontWeight:700, color:'#111', marginBottom:16 }}>Nueva categoría</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                  <div>
                    <label style={lbl}>Nombre</label>
                    <input value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name:e.target.value }))} placeholder="ej: Evento especial" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Slug (sin espacios)</label>
                    <input value={newCat.slug} onChange={e => setNewCat(n => ({ ...n, slug:e.target.value.toLowerCase().replace(/\s+/g,'_') }))} placeholder="ej: evento_especial" style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Color</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                    {DEFAULT_COLORS.map(c => (
                      <button key={c} onClick={() => setNewCat(n => ({ ...n, color:c }))} style={{ width:28, height:28, borderRadius:7, background:c, border: newCat.color===c ? '2px solid #111' : '2px solid transparent', cursor:'pointer' }} />
                    ))}
                  </div>
                  <input type="color" value={newCat.color} onChange={e => setNewCat(n => ({ ...n, color:e.target.value }))} style={{ width:40, height:32, border:'none', borderRadius:6, cursor:'pointer', background:'transparent' }} />
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={() => setShowNewCat(false)} style={{ background:'transparent', border:'1px solid #e0e0e0', color:'#999', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Cancelar</button>
                  <button onClick={saveNewCat} disabled={savingCat||!newCat.name||!newCat.slug} style={{ background:'#f15922', border:'none', color:'#fff', padding:'9px 22px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'Montserrat', opacity:(!newCat.name||!newCat.slug)?0.4:1 }}>
                    {savingCat ? '...' : 'Crear'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:`3px solid ${cat.color}`, borderRadius:10, padding:'14px 16px' }}>
                  {editCat?.id===cat.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <label style={lbl}>Nombre</label>
                        <input value={editCat.name} onChange={e => setEditCat({ ...editCat, name:e.target.value })} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Color</label>
                        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:8 }}>
                          {DEFAULT_COLORS.map(c => (
                            <button key={c} onClick={() => setEditCat({ ...editCat, color:c })} style={{ width:26, height:26, borderRadius:6, background:c, border: editCat.color===c ? '2px solid #111' : '2px solid transparent', cursor:'pointer' }} />
                          ))}
                        </div>
                        <input type="color" value={editCat.color} onChange={e => setEditCat({ ...editCat, color:e.target.value })} style={{ width:36, height:28, border:'none', borderRadius:5, cursor:'pointer', background:'transparent' }} />
                      </div>
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button onClick={() => setEditCat(null)} style={{ background:'transparent', border:'1px solid #e0e0e0', color:'#999', padding:'7px 14px', borderRadius:7, cursor:'pointer', fontSize:12 }}>Cancelar</button>
                        <button onClick={saveCatEdit} disabled={savingCat} style={{ background:'#f15922', border:'none', color:'#fff', padding:'7px 18px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'Montserrat' }}>
                          {savingCat ? '...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:14, height:14, borderRadius:4, background:cat.color, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'#111', fontFamily:'Montserrat' }}>{cat.name}</div>
                        <div style={{ fontSize:11, color:'#ccc', fontFamily:'Barlow Condensed', letterSpacing:0.5 }}>{cat.slug} · {cat.color}</div>
                      </div>
                      <button onClick={() => setEditCat(cat)} style={{ background:'#f5f5f5', border:'1px solid #e8e8e8', color:'#888', padding:'6px 12px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'Barlow Condensed' }}>Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* IMPORTAR CSV */}
        {tab==='importar' && (
          <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:14, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontFamily:'Montserrat', fontSize:16, fontWeight:700, color:'#111', marginBottom:8 }}>Importar desde CSV</h2>
            <p style={{ fontSize:13, color:'#bbb', fontFamily:'Barlow', marginBottom:24, lineHeight:1.5 }}>
              Subí el CSV exportado del Sheet. Detecta automáticamente el tipo por el prefijo (CURSO:, CONGRESO:, etc.) y reconoce DMT como Curso DM Training. Solo importa desde junio en adelante.
            </p>

            <div onClick={() => fileRef.current?.click()}
              style={{ border:'1.5px dashed #e0e0e0', borderRadius:12, padding:'32px 24px', textAlign:'center', cursor:'pointer', marginBottom:20, background:'#fafafa', transition:'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor='#f15922')}
              onMouseLeave={e => (e.currentTarget.style.borderColor='#e0e0e0')}>
              <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
              <div style={{ fontSize:14, color:'#bbb', fontFamily:'Barlow' }}>Hacé click para seleccionar el CSV</div>
              <div style={{ fontSize:11, color:'#ccc', fontFamily:'Barlow Condensed', marginTop:4, letterSpacing:0.5 }}>Archivo → Descargar → CSV desde Google Sheets</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleFileLoad} />

            {csvPreview.length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ fontSize:13, color:'#888', fontFamily:'Barlow' }}>
                    <span style={{ color:'#f15922', fontWeight:700 }}>{csvPreview.length}</span> actividades detectadas
                  </div>
                  <button onClick={importCSV} disabled={csvImporting||csvDone}
                    style={{ background: csvDone ? '#f0fdf4' : '#f15922', border: csvDone ? '1px solid #bbf7d0' : 'none', color: csvDone ? '#16a34a' : '#fff', padding:'9px 20px', borderRadius:8, cursor: csvDone ? 'default' : 'pointer', fontSize:13, fontWeight:700, fontFamily:'Montserrat', opacity: csvImporting ? 0.6 : 1 }}>
                    {csvDone ? '✓ Importado' : csvImporting ? 'Importando...' : 'Importar todo'}
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:400, overflowY:'auto' }}>
                  {csvPreview.map((act, i) => {
                    const cat = catMap[act.category_slug]||{ color:'#888', name:act.category_slug }
                    return (
                      <div key={i} style={{ background:'#fafafa', border:'1px solid #f0f0f0', borderLeft:`2px solid ${cat.color}`, borderRadius:8, padding:'8px 12px' }}>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <span style={{ fontSize:10, color:cat.color, fontFamily:'Barlow Condensed', letterSpacing:1, minWidth:90, textTransform:'uppercase', fontWeight:700 }}>{cat.name}</span>
                          <span style={{ fontSize:12, color:'#333', fontFamily:'Barlow', flex:1 }}>{act.name}</span>
                          <span style={{ fontSize:11, color:'#ccc', fontFamily:'Barlow Condensed', flexShrink:0 }}>{act.start_date}{act.end_date!==act.start_date ? ` → ${act.end_date}` : ''}</span>
                        </div>
                        {(act.location||act.dictante) && (
                          <div style={{ fontSize:11, color:'#bbb', fontFamily:'Barlow', marginTop:3, paddingLeft:100 }}>
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
        )}
      </div>
    </div>
  )
}
