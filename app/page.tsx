'use client'

import { useState, useEffect } from 'react'
import { supabase, Activity } from '@/lib/supabase'
import CalendarView from '@/components/CalendarView'

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => { fetchActivities() }, [])

  async function fetchActivities() {
    const { data } = await supabase.from('cal_activities').select('*').order('start_date')
    setActivities(data || [])
    setLoading(false)
  }

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const year = currentDate.getFullYear()

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div style={{ borderBottom: '1px solid var(--border)', padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--orange)', fontFamily: 'Barlow Condensed', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>Dental Medrano</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'Montserrat', textTransform: 'capitalize' }}>Calendario {monthName} {year}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>‹</button>
          <button onClick={() => setCurrentDate(new Date())} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', height: 36, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>HOY</button>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>›</button>
        </div>
      </div>

      <div style={{ padding: '12px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {[
          { color: 'var(--green)', label: 'Viaje' },
          { color: 'var(--orange)', label: 'Curso DM Training' },
          { color: 'var(--blue)', label: 'Curso externo' },
          { color: 'var(--purple)', label: 'Congreso' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>
        : <CalendarView activities={activities} currentDate={currentDate} />
      }
    </main>
  )
}
