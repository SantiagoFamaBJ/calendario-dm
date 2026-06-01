'use client'

import { useState, useEffect } from 'react'
import { supabase, Activity, ActivityType } from '@/lib/supabase'

const ADMIN_KEY = 'cal_dm_admin_auth'
const ADMIN_PASS = 'DM2026'

const TYPE_CONFIG: Record<ActivityType, { color: string; label: string; icon: string }> = {
  viaje:         { color: '#10b981', label: 'Viaje', icon: '✈' },
  curso_dm:      { color: '#f15922', label: 'Curso DM Training', icon: '🎓' },
  curso_externo: { color: '#3b82f6', label: 'Curso externo', icon: '📚' },
  congreso:      { color: '#8b5cf6', label: 'Congreso', icon: '🏛' },
}

const EMPTY_FORM = { type: 'curso_dm' as ActivityType, name: '', start_date: '', end_date: '', location: '', vendedor: '', dictante: '' }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<ActivityType | 'all'>('all')

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(ADMIN_KEY) === 'true') setAuthed(true)
  }, [])

  useEffect(() => { if (authed) fetchAll() }, [authed])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('cal_activities').select('*').order('start_date')
    setActivities(data || [])
    setLoading(false)
  }

  function handleLogin() {
    if (pass === ADMIN_PASS) { localStorage.setItem(ADMIN_KEY, 'true'); setAuthed(true) }
    else { setPassError(true); setTimeout(() => setPassError(false), 2000) }
  }

  function handleLogout() { localStorage.removeItem(ADMIN_KEY); setAuthed(false) }

  function startEdit(act: Activity) {
    setForm({ type: act.type, name: act.name, start_date: act.start_date, end_date: act.end_date, location: act.location, vendedor: act.vendedor, dictante: act.dictante || '' })
    setEditId(act.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setForm(EMPTY_FORM); setEditId(null); setShowForm(false) }

  async function handleSave() {
    if (!form.name || !form.start_date || !form.end_date || !form.location || !form.vendedor) return
    setSaving(true)
    const payload = { type: form.type, name: form.name, start_date: form.start_date, end_date: form.end_date, location: form.location, vendedor: form.vendedor, dictante: form.dictante || null }
    if (editId) await supabase.from('cal_activities').update(payload).eq('id', editId)
    else await supabase.from('cal_activities').insert(payload)
    await fetchAll(); resetForm(); setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('cal_activities').delete().eq('id', id)
    setDeleteConfirm(null); await fetchAll()
  }

  const filtered = filter === 'all' ? activities : activities.filter(a => a.type === filter)

  const inp = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#f5f5f5', padding: '10px 12px', fontSize: 14, fontFamily: 'Barlow, sans-serif', width: '100%', outline: 'none' }
  const lbl = { fontSize: 11, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: 1, color: '#888', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: 16 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 20, padding: 40, width: '100%', maxWidth: 360 }}>
        <div style={{ marginBottom: 8, fontSize: 11, color: '#f15922', fontFamily: 'Barlow Condensed', letterSpacing: 2, textTransform: 'uppercase' }}>Admin</div>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: '#f5f5f5', marginBottom: 32 }}>Calendario DM</h1>
        <label style={lbl}>Contraseña</label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••" style={{ ...inp, border: passError ? '1px solid #f15922' : '1px solid #333', marginBottom: 4 }} autoFocus />
        {passError && <p style={{ color: '#f15922', fontSize: 12, marginBottom: 8, fontFamily: 'Barlow' }}>Contraseña incorrecta</p>}
        <div style={{ height: 16 }} />
        <button onClick={handleLogin} style={{ width: '100%', background: '#f15922', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer' }}>Ingresar</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <div style={{ fontSize: 11, color: '#f15922', fontFamily: 'Barlow Condensed', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>Admin</div>
          <h1 style={{ fontFamily: 'Montserrat', fontSize: 18, fontWeight: 800, color: '#f5f5f5' }}>Calendario DM</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/" target="_blank" style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '8px 14px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>Ver calendario →</a>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_FORM) }} style={{ background: showForm ? '#333' : '#f15922', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer' }}>
            {showForm ? 'Cancelar' : '+ Nueva actividad'}
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #333', color: '#666', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>⏏</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {showForm && (
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 24, marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 20 }}>{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {(Object.entries(TYPE_CONFIG) as [ActivityType, typeof TYPE_CONFIG[ActivityType]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))} style={{ background: form.type === key ? `${cfg.color}22` : '#1a1a1a', border: `1px solid ${form.type === key ? cfg.color : '#333'}`, borderRadius: 8, color: form.type === key ? cfg.color : '#888', padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'Barlow Condensed', letterSpacing: 0.5, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{cfg.icon}</span><span>{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.type === 'viaje' ? 'ej: Visita Mar del Plata' : 'ej: Endodoncia avanzada'} style={inp} />
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
                <label style={lbl}>{form.type === 'viaje' ? 'Destino' : 'Lugar'}</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={form.type === 'viaje' ? 'ej: Mar del Plata' : 'ej: Dental Medrano Training – CABA'} style={inp} />
              </div>
              <div>
                <label style={lbl}>Vendedor</label>
                <input value={form.vendedor} onChange={e => setForm(f => ({ ...f, vendedor: e.target.value }))} placeholder="Nombre del vendedor" style={inp} />
              </div>
              {form.type !== 'viaje' && (
                <div>
                  <label style={lbl}>Dictante</label>
                  <input value={form.dictante} onChange={e => setForm(f => ({ ...f, dictante: e.target.value }))} placeholder="Nombre del dictante" style={inp} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.start_date || !form.end_date || !form.location || !form.vendedor} style={{ background: '#f15922', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat', opacity: (saving || !form.name || !form.start_date || !form.end_date || !form.location || !form.vendedor) ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['all', 'viaje', 'curso_dm', 'curso_externo', 'congreso'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#f15922' : '#1a1a1a', border: `1px solid ${filter === f ? '#f15922' : '#333'}`, color: filter === f ? '#fff' : '#888', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>
              {f === 'all' ? 'Todas' : TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 60, fontFamily: 'Barlow Condensed', fontSize: 14 }}>No hay actividades cargadas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(act => {
              const cfg = TYPE_CONFIG[act.type]
              return (
                <div key={act.id} style={{ background: '#111', border: '1px solid #222', borderLeft: `3px solid ${cfg.color}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: cfg.color, fontFamily: 'Barlow Condensed', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{cfg.icon} {cfg.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f5', fontFamily: 'Montserrat', marginBottom: 4 }}>{act.name}</div>
                    <div style={{ fontSize: 12, color: '#888', fontFamily: 'Barlow' }}>
                      {act.start_date === act.end_date ? act.start_date : `${act.start_date} → ${act.end_date}`} · {act.location} · {act.vendedor}
                      {act.dictante ? ` · ${act.dictante}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(act)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✏</button>
                    {deleteConfirm === act.id
                      ? <button onClick={() => handleDelete(act.id)} style={{ background: '#7f1d1d', border: 'none', color: '#fca5a5', padding: '0 10px', height: 32, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Barlow Condensed' }}>¿Borrar?</button>
                      : <button onClick={() => setDeleteConfirm(act.id)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>🗑</button>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
