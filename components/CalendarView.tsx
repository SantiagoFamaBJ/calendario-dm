'use client'

import { useState } from 'react'
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

function isInRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function CalendarView({ activities, categories, currentDate }: Props) {
  const [selected, setSelected] = useState<Activity | null>(null)

  const catMap = Object.fromEntries(categories.map(c => [c.slug, c]))

  function getCat(act: Activity) {
    return catMap[act.category_slug] || catMap[act.type] || { color: '#888', name: act.category_slug || act.type, slug: '' }
  }

  function isViaje(act: Activity) {
    return act.category_slug === 'viaje' || act.type === 'viaje'
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

  const today = new Date()

  // Assign a "row" to each activity so they don't overlap
  // For each week, figure out which activities appear and stack them
  function getWeekLayout(week: (Date | null)[]) {
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return {}

    const weekStart = validDays[0]
    const weekEnd = validDays[validDays.length - 1]

    // Get all activities that appear in this week
    const weekActs = activities.filter(a => {
      const s = parseLocalDate(a.start_date)
      const e = parseLocalDate(a.end_date)
      return isInRange(weekStart, s, e) || isInRange(weekEnd, s, e) ||
        (s.getTime() >= weekStart.getTime() && e.getTime() <= weekEnd.getTime())
    })

    // Sort: viajes first, then by category order, then by start date
    const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
    weekActs.sort((a, b) => {
      const aV = isViaje(a) ? -1 : 0
      const bV = isViaje(b) ? -1 : 0
      if (aV !== bV) return aV - bV
      const ao = catOrder[a.category_slug] ?? 99
      const bo = catOrder[b.category_slug] ?? 99
      if (ao !== bo) return ao - bo
      return parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime()
    })

    // Assign rows (like Google Calendar)
    const rows: Activity[][] = []
    const actRow: Record<string, number> = {}

    for (const act of weekActs) {
      const s = parseLocalDate(act.start_date)
      const e = parseLocalDate(act.end_date)
      let placed = false
      for (let r = 0; r < rows.length; r++) {
        const conflict = rows[r].some(other => {
          const os = parseLocalDate(other.start_date)
          const oe = parseLocalDate(other.end_date)
          return !(e.getTime() < os.getTime() || s.getTime() > oe.getTime())
        })
        if (!conflict) { rows[r].push(act); actRow[act.id] = r; placed = true; break }
      }
      if (!placed) { rows.push([act]); actRow[act.id] = rows.length - 1 }
    }

    return actRow
  }

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const ROW_H = 24 // px per activity row
  const ROW_GAP = 3
  const DAY_NUM_H = 32 // space for day number
  const MIN_H = 110

  return (
    <>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: 1.5,
            color: i >= 5 ? '#ccc' : '#aaa',
            padding: '9px 0', fontWeight: 700, textTransform: 'uppercase',
            borderRight: i < 6 ? '1px solid #e8e8e8' : 'none',
          }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const actRow = getWeekLayout(week)
        const validDays = week.filter(Boolean) as Date[]
        const weekStart = validDays[0]
        const weekEnd = validDays[validDays.length - 1]

        // All activities in this week, sorted by row
        const weekActs = activities.filter(a => {
          const s = parseLocalDate(a.start_date)
          const e = parseLocalDate(a.end_date)
          return isInRange(weekStart, s, e) || isInRange(weekEnd, s, e) ||
            (s.getTime() >= weekStart.getTime() && e.getTime() <= weekEnd.getTime())
        })

        const numRows = weekActs.length > 0 ? Math.max(...weekActs.map(a => (actRow[a.id] ?? 0) + 1)) : 0
        const weekH = Math.max(MIN_H, DAY_NUM_H + numRows * (ROW_H + ROW_GAP) + 8)

        return (
          <div key={wi} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: wi < weeks.length - 1 ? '1px solid #e8e8e8' : 'none',
            height: weekH,
            position: 'relative',
          }}>
            {/* Day number cells */}
            {week.map((date, di) => {
              const isToday = date ? isSameDay(date, today) : false
              const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false
              return (
                <div key={di} style={{
                  borderRight: di < 6 ? '1px solid #e8e8e8' : 'none',
                  background: isWeekend ? '#fafafa' : '#fff',
                  height: '100%',
                  position: 'relative',
                }}>
                  {date && (
                    <div style={{
                      width: 26, height: 26,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '5px auto 0',
                      borderRadius: '50%',
                      background: isToday ? '#f15922' : 'transparent',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#fff' : isWeekend ? '#ccc' : '#999',
                      fontFamily: 'Montserrat',
                    }}>
                      {date.getDate()}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Activity bars — absolutely positioned over the grid */}
            {weekActs.map(act => {
              const cat = getCat(act)
              const viaje = isViaje(act)
              const actStart = parseLocalDate(act.start_date)
              const actEnd = parseLocalDate(act.end_date)

              // Which columns does this activity span in this week?
              const colStart = week.findIndex(d => d && isSameDay(d, actStart) || (d && actStart < weekStart && isSameDay(d, weekStart)))
              const colEnd = week.findIndex(d => d && isSameDay(d, actEnd))

              // Compute column indices properly
              let startCol = 0
              let endCol = 6
              for (let i = 0; i < 7; i++) {
                const d = week[i]
                if (!d) continue
                if (actStart <= weekEnd && actEnd >= weekStart) {
                  if (d.getTime() <= actStart.getTime() && actStart.getTime() <= weekEnd.getTime()) {
                    if (actStart >= weekStart) startCol = i
                  }
                  if (d.getTime() >= actEnd.getTime() && actEnd.getTime() >= weekStart.getTime()) {
                    if (actEnd <= weekEnd) endCol = i
                  }
                }
              }

              // Recompute properly
              startCol = 0; endCol = 6
              for (let i = 0; i < 7; i++) {
                const d = week[i]
                if (!d) continue
                if (isSameDay(d, actStart) || (actStart < weekStart && isSameDay(d, weekStart))) startCol = i
                if (isSameDay(d, actEnd) || (actEnd > weekEnd && isSameDay(d, weekEnd))) endCol = i
              }

              const row = actRow[act.id] ?? 0
              const top = DAY_NUM_H + row * (ROW_H + ROW_GAP)
              const startsThisWeek = actStart >= weekStart
              const endsThisWeek = actEnd <= weekEnd

              const label = viaje
                ? `✈ ${act.vendedor || act.name}${act.location ? ' — ' + act.location : ''}`
                : act.name + (act.dictante ? ' · ' + act.dictante : '')

              return (
                <div
                  key={act.id}
                  onClick={() => setSelected(act)}
                  title={act.name}
                  style={{
                    position: 'absolute',
                    top,
                    left: `calc(${startCol / 7 * 100}% + ${startsThisWeek ? 3 : 0}px)`,
                    right: `calc(${(6 - endCol) / 7 * 100}% + ${endsThisWeek ? 3 : 0}px)`,
                    height: ROW_H,
                    background: `${cat.color}18`,
                    borderTop: `2px solid ${cat.color}`,
                    borderBottom: `2px solid ${cat.color}`,
                    borderLeft: startsThisWeek ? `2px solid ${cat.color}` : 'none',
                    borderRight: endsThisWeek ? `2px solid ${cat.color}` : 'none',
                    borderRadius: startsThisWeek && endsThisWeek ? 5 : startsThisWeek ? '5px 0 0 5px' : endsThisWeek ? '0 5px 5px 0' : 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 6,
                    paddingRight: 4,
                    zIndex: 10,
                    transition: 'filter 0.1s',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.9)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
                >
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    color: cat.color,
                    letterSpacing: 0.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Modal */}
      {selected && (() => {
        const cat = getCat(selected)
        const viaje = isViaje(selected)
        return (
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: `1px solid ${cat.color}30`, borderRadius: 18, padding: 28, maxWidth: 420, width: '100%', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cat.color}12`, border: `1px solid ${cat.color}35`, borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, color: cat.color, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {viaje ? '✈ ' : ''}{cat.name}
                </span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Montserrat', color: '#111', marginBottom: 20, lineHeight: 1.25 }}>{selected.name}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {[
                  { label: 'Fechas', value: selected.start_date === selected.end_date ? formatDate(selected.start_date) : `${formatDate(selected.start_date)} → ${formatDate(selected.end_date)}` },
                  { label: viaje ? 'Destino' : 'Lugar', value: selected.location || '—' },
                  { label: 'Vendedor', value: selected.vendedor || '—' },
                  ...(selected.dictante && !viaje ? [{ label: 'Dictante', value: selected.dictante }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', color: '#bbb', letterSpacing: 1.5, textTransform: 'uppercase', minWidth: 64, paddingTop: 2, flexShrink: 0, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 14, color: '#333', fontFamily: 'Barlow', lineHeight: 1.4, textTransform: 'capitalize' }}>{value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 16, right: 16, background: '#f5f5f5', border: '1px solid #e8e8e8', color: '#aaa', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
