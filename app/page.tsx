'use client'

import { useState, useEffect } from 'react'
import { supabase, Activity, Category } from '@/lib/supabase'
import CalendarView from '@/components/CalendarView'
import PrintView from '@/components/PrintView'

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: acts }, { data: cats }] = await Promise.all([
      supabase.from('cal_activities').select('*').order('start_date'),
      supabase.from('cal_categories').select('*').order('sort_order'),
    ])
    setActivities(acts || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const year = currentDate.getFullYear()

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm;
            height: 210mm;
            overflow: hidden;
          }
          #screen-view { display: none !important; }
          #print-view {
            display: flex !important;
            position: fixed;
            inset: 0;
            width: 297mm;
            height: 210mm;
            align-items: center;
            justify-content: center;
            background: white;
          }
        }
        @media screen {
          #print-view { display: none !important; }
        }
      `}</style>

      {/* Print view — hidden on screen */}
      <div id="print-view">
        <PrintView activities={activities} categories={categories} currentDate={currentDate} />
      </div>

      {/* Screen view */}
      <main id="screen-view" style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
        <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 34, height: 34, background: 'var(--orange)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, fontFamily: 'Montserrat' }}>DM</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--orange)', fontFamily: 'Barlow Condensed', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Dental Medrano</div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', fontFamily: 'Montserrat', textTransform: 'capitalize', lineHeight: 1.1 }}>
                Calendario {monthName} {year}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => window.print()}
              style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', color: '#555', height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🖨 Imprimir
            </button>
            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={() => setCurrentDate(new Date())}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text-muted)', height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: 1.5, textTransform: 'uppercase' }}>Hoy</button>
            <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </header>

        {categories.length > 0 && (
          <div style={{ padding: '10px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            {categories.map(cat => (
              <div key={cat.slug} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{cat.name}</span>
              </div>
            ))}
          </div>
        )}

        {loading
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>Cargando...</div>
          : <CalendarView activities={activities} categories={categories} currentDate={currentDate} />
        }
      </main>
    </>
  )
}
