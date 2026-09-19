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
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

  function getWeekActsWithRows(week: (Date | null)[]) {
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return { acts: [] as Activity[], actRow: {} as Record<string, number>, maxRow: 0 }
    const weekStart = validDays[0]; const weekEnd = validDays[validDays.length - 1]
    const weekActs = activities.filter(a => {
      const s = parseLocalDate(a.start_date); const e = parseLocalDate(a.end_date)
      return s <= weekEnd && e >= weekStart
    })
    const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
    weekActs.sort((a, b) => {
      if (isViaje(a) && !isViaje(b)) return -1
      if (!isViaje(a) && isViaje(b)) return 1
      const ao = catOrder[a.category_slug] ?? 99; const bo = catOrder[b.category_slug] ?? 99
      if (ao !== bo) return ao - bo
      return parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime()
    })
    const rows: Activity[][] = []; const actRow: Record<string, number> = {}
    for (const act of weekActs) {
      const s = parseLocalDate(act.start_date); const e = parseLocalDate(act.end_date)
      let placed = false
      for (let r = 0; r < rows.length; r++) {
        const conflict = rows[r].some(o => {
          const os = parseLocalDate(o.start_date); const oe = parseLocalDate(o.end_date)
          return !(e < os || s > oe)
        })
        if (!conflict) { rows[r].push(act); actRow[act.id] = r; placed = true; break }
      }
      if (!placed) { rows.push([act]); actRow[act.id] = rows.length - 1 }
    }
    return { acts: weekActs, actRow, maxRow: rows.length }
  }

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const DAY_HEADERS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  let weeksHTML = ''
  weeks.forEach((week, wi) => {
    const { acts: weekActs, actRow, maxRow } = getWeekActsWithRows(week)
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return
    const weekStart = validDays[0]; const weekEnd = validDays[validDays.length - 1]
    const numRows = Math.max(maxRow, 1)

    // Grid template: row1 = day number (7mm), rows 2..n = activity tracks (5.5mm each)
    const gridTemplateRows = `7mm repeat(${numRows}, 5.5mm)`

    let cellsHTML = ''
    week.forEach((date, di) => {
      const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false
      const isToday = date ? isSameDay(date, new Date()) : false
      const borderR = di < 6 ? 'border-right:0.3mm solid #ddd;' : ''
      cellsHTML += `<div style="grid-column:${di + 1};grid-row:1 / span ${numRows + 1};background:${isWeekend ? '#f9f9f9' : '#fff'};${borderR}z-index:0;"></div>`
      if (date) {
        const numStyle = isToday
          ? 'background:#f15922;color:#fff;font-weight:800;'
          : isWeekend ? 'color:#bbb;font-weight:600;' : 'color:#444;font-weight:600;'
        cellsHTML += `<div style="grid-column:${di + 1};grid-row:1;display:flex;align-items:center;justify-content:center;z-index:1;"><span style="${numStyle}font-size:9pt;width:6mm;height:6mm;border-radius:50%;display:flex;align-items:center;justify-content:center;">${date.getDate()}</span></div>`
      }
    })

    let barsHTML = ''
    weekActs.forEach(act => {
      const cat = getCat(act)
      const viaje = isViaje(act); const congreso = isCongreso(act)
      const actStart = parseLocalDate(act.start_date); const actEnd = parseLocalDate(act.end_date)
      const startsThisWeek = actStart >= weekStart; const endsThisWeek = actEnd <= weekEnd

      let startCol = 0, endCol = 6
      for (let i = 0; i < 7; i++) {
        const d = week[i]; if (!d) continue
        if (isSameDay(d, actStart) || (!startsThisWeek && isSameDay(d, weekStart))) startCol = i
        if (isSameDay(d, actEnd) || (!endsThisWeek && isSameDay(d, weekEnd))) endCol = i
      }

      const row = (actRow[act.id] ?? 0) + 2
      const bg = viaje ? cat.color : congreso ? `${cat.color}30` : `${cat.color}22`
      const borderTop = `${congreso ? 0.8 : 0.5}mm solid ${cat.color}`
      const borderBottom = borderTop
      const borderLeft = startsThisWeek ? `${congreso ? 1.5 : 1}mm solid ${cat.color}` : 'none'
      const borderRight = endsThisWeek ? `0.5mm solid ${cat.color}` : 'none'
      const br = startsThisWeek && endsThisWeek ? '1mm' : startsThisWeek ? '1mm 0 0 1mm' : endsThisWeek ? '0 1mm 1mm 0' : '0'
      const label = viaje
        ? `✈ ${act.vendedor || act.name}${act.location ? ' — ' + act.location : ''}`
        : act.name + (act.dictante ? ' · ' + act.dictante : '')
      const textColor = viaje ? '#fff' : cat.color
      const fw = viaje ? 800 : congreso ? 700 : 600
      const fs = viaje ? '8pt' : '7pt'
      const marginL = startsThisWeek ? '0.5mm' : '0'
      const marginR = endsThisWeek ? '0.5mm' : '0'

      barsHTML += `
        <div style="grid-column:${startCol + 1} / ${endCol + 2};grid-row:${row};margin:0 ${marginR} 0 ${marginL};background:${bg};border-top:${borderTop};border-bottom:${borderBottom};border-left:${borderLeft};border-right:${borderRight};border-radius:${br};display:flex;align-items:center;padding-left:1.5mm;overflow:hidden;box-sizing:border-box;z-index:${congreso ? 3 : viaje ? 2 : 1};min-width:0;">
          <span style="font-size:${fs};font-weight:${fw};color:${textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Barlow Condensed',Arial,sans-serif;letter-spacing:0.2pt;">${label}</span>
        </div>`
    })

    const borderB = wi < weeks.length - 1 ? 'border-bottom:0.3mm solid #ddd;' : ''
    weeksHTML += `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:${gridTemplateRows};row-gap:0.8mm;padding-bottom:1.5mm;${borderB}">
        ${cellsHTML}
        ${barsHTML}
      </div>`
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Calendario ${monthName} ${year} — Dental Medrano</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: A4 landscape; margin: 8mm 10mm; }
    body { width:277mm; height:193mm; overflow:hidden; font-family:'Barlow Condensed',Arial,sans-serif; background:#fff; }
    html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style>
</head>
<body>
  <div style="width:277mm;height:193mm;display:flex;flex-direction:column;">
    <div style="flex:1;display:flex;flex-direction:column;border:0.3mm solid #ccc;border-radius:1.5mm;overflow:hidden;min-height:0;">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);background:#f2f2f2;border-bottom:0.3mm solid #ccc;flex-shrink:0;">
        ${DAY_HEADERS.map((d, i) => `<div style="text-align:center;font-size:7pt;font-weight:700;letter-spacing:0.5pt;text-transform:uppercase;color:${i >= 5 ? '#bbb' : '#777'};padding:2mm 0;border-right:${i < 6 ? '0.3mm solid #ddd' : 'none'};font-family:'Barlow Condensed',Arial;">${d}</div>`).join('')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0;">
        ${weeksHTML}
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
