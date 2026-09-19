'use client'

import { Activity, Category } from '@/lib/supabase'

interface Props {
  activities: Activity[]
  categories: Category[]
  currentDate: Date
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function PrintView({ activities, categories, currentDate }: Props) {
  const catMap = Object.fromEntries(categories.map(c => [c.slug, c]))
  const getCat = (act: Activity) => catMap[act.category_slug] || catMap[act.type] || { color: '#333', name: act.category_slug, slug: '' }
  const isViaje = (act: Activity) => act.category_slug === 'viaje' || act.type === 'viaje'
  const isCongreso = (act: Activity) => act.category_slug === 'congreso' || act.type === 'congreso'

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

  function getWeekLayout(week: (Date | null)[]) {
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return {}
    const weekStart = validDays[0]; const weekEnd = validDays[validDays.length - 1]
    const weekActs = activities.filter(a => {
      const s = parseLocalDate(a.start_date); const e = parseLocalDate(a.end_date)
      return s <= weekEnd && e >= weekStart
    })
    const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
    weekActs.sort((a, b) => {
      if (isViaje(a) && !isViaje(b)) return -1
      if (!isViaje(a) && isViaje(b)) return 1
      return (catOrder[a.category_slug] ?? 99) - (catOrder[b.category_slug] ?? 99)
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
    return actRow
  }

  const monthName = currentDate.toLocaleString('es-AR', { month: 'long' })
  const DAY_HEADERS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  return (
    <div id="print-view" style={{
      width: '277mm',
      height: '190mm',
      padding: '0',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Barlow Condensed', 'Montserrat', sans-serif",
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3mm', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
          <div style={{ width: '7mm', height: '7mm', background: '#f15922', borderRadius: '1.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '4.5pt', fontWeight: 900, fontFamily: 'Montserrat' }}>DM</span>
          </div>
          <div>
            <div style={{ fontSize: '5.5pt', color: '#f15922', letterSpacing: '1pt', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1 }}>Dental Medrano</div>
            <div style={{ fontSize: '13pt', fontWeight: 800, color: '#111', textTransform: 'capitalize', lineHeight: 1.1, fontFamily: 'Montserrat' }}>
              Calendario {monthName} {year}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5mm', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {categories.map(cat => (
            <div key={cat.slug} style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
              <div style={{ width: '2.5mm', height: '2.5mm', borderRadius: '0.5mm', background: cat.color }} />
              <span style={{ fontSize: '5.5pt', color: '#444', fontWeight: 600 }}>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '0.25mm solid #ccc', borderRadius: '1mm', overflow: 'hidden', minHeight: 0 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f2f2f2', borderBottom: '0.25mm solid #ccc', flexShrink: 0 }}>
          {DAY_HEADERS.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '5.5pt', fontWeight: 700, letterSpacing: '0.3pt', textTransform: 'uppercase', color: i >= 5 ? '#bbb' : '#777', padding: '1.5mm 0', borderRight: i < 6 ? '0.25mm solid #ccc' : 'none' }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {weeks.map((week, wi) => {
            const actRow = getWeekLayout(week)
            const validDays = week.filter(Boolean) as Date[]
            if (!validDays.length) return null
            const weekStart = validDays[0]; const weekEnd = validDays[validDays.length - 1]
            const weekActs = activities.filter(a => {
              const s = parseLocalDate(a.start_date); const e = parseLocalDate(a.end_date)
              return s <= weekEnd && e >= weekStart
            })

            return (
              <div key={wi} style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '0.25mm solid #ccc' : 'none', position: 'relative', minHeight: 0 }}>
                {week.map((date, di) => {
                  const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false
                  const isToday = date ? isSameDay(date, new Date()) : false
                  return (
                    <div key={di} style={{ borderRight: di < 6 ? '0.25mm solid #ccc' : 'none', background: isWeekend ? '#f9f9f9' : '#fff', padding: '1mm 1.5mm 0', boxSizing: 'border-box', height: '100%' }}>
                      {date && (
                        <div style={{ width: '4.5mm', height: '4.5mm', borderRadius: '50%', background: isToday ? '#f15922' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '6.5pt', fontWeight: isToday ? 800 : 600, color: isToday ? '#fff' : isWeekend ? '#bbb' : '#444', fontFamily: 'Montserrat' }}>{date.getDate()}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {weekActs.map(act => {
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

                  const row = actRow[act.id] ?? 0
                  const topMm = 5.5 + row * 5

                  const label = viaje
                    ? `✈ ${act.vendedor || act.name}${act.location ? ' — ' + act.location : ''}`
                    : act.name + (act.dictante ? ' · ' + act.dictante : '')

                  const showLabel = startsThisWeek || isSameDay(weekStart, week.find(d => d !== null)!)

                  return (
                    <div key={act.id} style={{
                      position: 'absolute',
                      top: `${topMm}mm`,
                      left: `calc(${startCol / 7 * 100}% + ${startsThisWeek ? '0.4mm' : '0mm'})`,
                      right: `calc(${(6 - endCol) / 7 * 100}% + ${endsThisWeek ? '0.4mm' : '0mm'})`,
                      height: '4mm',
                      background: viaje ? cat.color : `${cat.color}25`,
                      border: `${congreso ? '0.5mm' : '0.3mm'} solid ${cat.color}`,
                      borderLeft: startsThisWeek ? `${congreso ? '0.8mm' : '0.5mm'} solid ${cat.color}` : 'none',
                      borderRight: endsThisWeek ? '0.3mm solid ' + cat.color : 'none',
                      borderRadius: startsThisWeek && endsThisWeek ? '0.7mm' : startsThisWeek ? '0.7mm 0 0 0.7mm' : endsThisWeek ? '0 0.7mm 0.7mm 0' : 0,
                      display: 'flex', alignItems: 'center', paddingLeft: '1mm',
                      overflow: 'hidden', boxSizing: 'border-box',
                      zIndex: viaje ? 11 : congreso ? 12 : 10,
                    }}>
                      {showLabel && (
                        <span style={{ fontSize: viaje ? '5.5pt' : '5pt', fontWeight: viaje ? 800 : congreso ? 700 : 600, color: viaje ? '#fff' : cat.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1pt' }}>
                          {label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
