'use client'

import { useState, useEffect } from 'react'
import { supabase, Activity, Category } from '@/lib/supabase'
import CalendarView from '@/components/CalendarView'

function generatePrintHTML(activities: Activity[], categories: Category[], currentDate: Date): string {
  const catMap = Object.fromEntries(categories.map(c => [c.slug, c]))
  const getCat = (act: Activity) => catMap[act.category_slug] || catMap[act.type] || { color: '#333', name: act.category_slug, slug: '' }
  const isViaje = (act: Activity) => act.category_slug === 'viaje' || act.type === 'viaje'
  const isCongreso = (act: Activity) => act.category_slug === 'congreso' || act.type === 'congreso'

  function parseLocalDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  function fmtShort(d: Date) {
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
  }
  function fmtRange(start: string, end: string) {
    const s = parseLocalDate(start); const e = parseLocalDate(end)
    if (start === end) return `${s.getDate()} ${s.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}`
    if (s.getMonth() === e.getMonth()) return `${s.getDate()} al ${e.getDate()} de ${e.toLocaleDateString('es-AR', { month: 'long' })}`
    return `${fmtShort(s)} → ${fmtShort(e)}`
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const days: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    days.push(dayNum < 1 || dayNum > lastDay.getDate() ? null : new Date(year, month, dayNum))
  }
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))

  // Group activities by week (based on start_date falling into that week's range)
  type WeekGroup = { label: string; acts: Activity[] }
  const weekGroups: WeekGroup[] = []
  weeks.forEach(week => {
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return
    const weekStart = validDays[0]; const weekEnd = validDays[validDays.length - 1]
    const acts = activities.filter(a => {
      const s = parseLocalDate(a.start_date); const e = parseLocalDate(a.end_date)
      return s <= weekEnd && e >= weekStart
    }).sort((a, b) => parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime())
    if (acts.length === 0) return
    const label = weekStart.getDate() === weekEnd.getDate()
      ? `${weekStart.getDate()}`
      : `${weekStart.getDate()} – ${weekEnd.getDate()}`
    weekGroups.push({ label, acts })
  })

  // Split weekGroups into 2 columns, balancing total row-weight (headers=1, rows=1)
  const weight = (g: WeekGroup) => 1 + g.acts.length
  const totalWeight = weekGroups.reduce((s, g) => s + weight(g), 0)
  let col1: WeekGroup[] = []; let col2: WeekGroup[] = []
  let running = 0
  for (const g of weekGroups) {
    if (running < totalWeight / 2) { col1.push(g); running += weight(g) }
    else col2.push(g)
  }
  if (col2.length === 0 && col1.length > 1) { col2.push(col1.pop()!) }

  function renderRow(act: Activity): string {
    const cat = getCat(act)
    const viaje = isViaje(act); const congreso = isCongreso(act)
    const dateRange = fmtRange(act.start_date, act.end_date)
    if (viaje) {
      return `
        <div style="flex:1 1 0;min-height:0;display:flex;align-items:center;gap:2.5mm;background:${cat.color};border-radius:1.2mm;padding:0 3mm;margin-bottom:1mm;">
          <span style="font-size:11pt;">✈</span>
          <div style="flex:1;min-width:0;overflow:hidden;">
            <div style="font-size:9.5pt;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Barlow Condensed',Arial;">${act.vendedor || act.name} — ${act.location || ''}</div>
          </div>
          <div style="font-size:7.5pt;color:rgba(255,255,255,0.85);font-weight:600;white-space:nowrap;flex-shrink:0;">${dateRange}</div>
        </div>`
    }
    const sub = [act.dictante, act.location].filter(Boolean).join('  ·  ')
    return `
      <div style="flex:1 1 0;min-height:0;display:flex;align-items:center;gap:2.5mm;background:${cat.color}12;border-left:${congreso ? '1.3mm' : '0.9mm'} solid ${cat.color};border-radius:0.8mm;padding:0 3mm;margin-bottom:1mm;">
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div style="font-size:9pt;font-weight:700;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Barlow Condensed',Arial;">${act.name}</div>
          ${sub ? `<div style="font-size:7pt;color:${cat.color};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>` : ''}
        </div>
        <div style="font-size:7.5pt;color:#999;font-weight:600;white-space:nowrap;flex-shrink:0;">${dateRange}</div>
      </div>`
  }

  function renderColumn(groups: WeekGroup[]): string {
    let html = ''
    groups.forEach(g => {
      html += `<div style="flex-shrink:0;font-size:7pt;font-weight:700;color:#aaa;letter-spacing:1pt;text-transform:uppercase;padding:1.5mm 0 1mm;border-bottom:0.3mm solid #eee;margin-bottom:1mm;font-family:'Barlow Condensed',Arial;">Semana del ${g.label}</div>`
      g.acts.forEach(act => { html += renderRow(act) })
    })
    return html
  }

  const legendHTML = categories.map(cat =>
    `<div style="display:flex;align-items:center;gap:1.5mm;"><div style="width:2.5mm;height:2.5mm;border-radius:0.5mm;background:${cat.color};flex-shrink:0;"></div><span style="font-size:6.5pt;color:#666;font-weight:600;">${cat.name}</span></div>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Calendario ${monthName} ${year} — Dental Medrano</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: A4 landscape; margin: 10mm 12mm; }
    body { width:273mm; height:190mm; overflow:hidden; font-family:'Barlow Condensed',Arial,sans-serif; background:#fff; }
    html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style>
</head>
<body>
  <div style="width:273mm;height:190mm;display:flex;flex-direction:column;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4mm;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:4mm;">
        <div style="width:11mm;height:11mm;background:#f15922;border-radius:2.2mm;display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:6.5pt;font-weight:900;font-family:'Montserrat',Arial;">DM</span>
        </div>
        <div>
          <div style="font-size:7.5pt;color:#f15922;letter-spacing:2pt;text-transform:uppercase;font-weight:700;line-height:1;font-family:'Montserrat',Arial;">Dental Medrano</div>
          <div style="font-size:22pt;font-weight:800;color:#111;text-transform:capitalize;line-height:1.1;font-family:'Montserrat',Arial;">Cronograma de ${monthName} ${year}</div>
        </div>
      </div>
      <div style="display:flex;gap:5mm;align-items:center;flex-wrap:wrap;justify-content:flex-end;">${legendHTML}</div>
    </div>

    <!-- Two columns -->
    <div style="flex:1;display:flex;gap:6mm;min-height:0;">
      <div style="flex:1;display:flex;flex-direction:column;min-height:0;border:0.3mm solid #eee;border-radius:2mm;padding:0 3mm;">
        ${renderColumn(col1)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-height:0;border:0.3mm solid #eee;border-radius:2mm;padding:0 3mm;">
        ${renderColumn(col2)}
      </div>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

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

  function handlePrint() {
    const html = generatePrintHTML(activities, categories, currentDate)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const year = currentDate.getFullYear()

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
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
          <button onClick={handlePrint} style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', color: '#555', height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow Condensed', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
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
  )
}
