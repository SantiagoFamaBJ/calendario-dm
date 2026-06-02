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

function diffDays(start: string, end: string) {
  return Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86400000) + 1
}

export default function CalendarView({ activities, categories, currentDate }: Props) {
  const [selected, setSelected] = useState<Activity | null>(null)
  const [tooltip, setTooltip] = useState<{ act: Activity; x: number; y: number } | null>(null)

  const catMap = Object.fromEntries(categories.map(c => [c.slug, c]))

  function getCat(act: Activity) {
    return catMap[act.category_slug] || catMap[act.type] || { color: '#888', name: act.category_slug || act.type, slug: '' }
  }

  function isViaje(act: Activity) { return act.category_slug === 'viaje' || act.type === 'viaje' }
  function isCongreso(act: Activity) { return act.category_slug === 'congreso' || act.type === 'congreso' }
  function isCursoDM(act: Activity) { return act.category_slug === 'curso_dm' || act.type === 'curso_dm' }

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

  function getWeekLayout(week: (Date | null)[]) {
    const validDays = week.filter(Boolean) as Date[]
    if (!validDays.length) return {}
    const weekStart = validDays[0]
    const weekEnd = validDays[validDays.length - 1]
    const weekActs = activities.filter(a => {
      const s = parseLocalDate(a.start_date)
      const e = parseLocalDate(a.end_date)
      return s <= weekEnd && e >= weekStart
    })
    const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
    weekActs.sort((a, b) => {
      if (isViaje(a) && !isViaje(b)) return -1
      if (!isViaje(a) && isViaje(b)) return 1
      const ao = catOrder[a.category_slug] ?? 99
      const bo = catOrder[b.category_slug] ?? 99
      if (ao !== bo) return ao - bo
      return parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime()
    })
    const rows: Activity[][] = []
    const actRow: Record<string, number> = {}
    for (const act of weekActs) {
      const s = parseLocalDate(act.start_date)
      const e = parseLocalDate(act.end_date)
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

  // Count per category this month
  const monthCounts = categories.map(cat => ({
    ...cat,
    count: activities.filter(a => {
      const s = parseLocalDate(a.start_date)
      return (a.category_slug === cat.slug || a.type === cat.slug) && s.getFullYear() === year && s.getMonth() === month
    }).length
  })).filter(c => c.count > 0)

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const ROW_H = 26
  const ROW_GAP = 3
  const DAY_NUM_H = 34
  const MIN_H = 120

  return (
    <>
      {/* Styles injected */}
      <style>{`
        @keyframes stripe-move {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        .viaje-bar {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 8px,
            rgba(255,255,255,0.15) 8px,
            rgba(255,255,255,0.15) 16px
          ) !important;
          background-size: 40px 40px !important;
          animation: stripe-move 3s linear infinite;
        }
        .cal-bar { transition: filter 0.12s, transform 0.12s; }
        .cal-bar:hover { filter: brightness(0.88) !important; transform: scaleY(1.08); }
      `}</style>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8' }}>
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
        if (!validDays.length) return null
        const weekStart = validDays[0]
        const weekEnd = validDays[validDays.length - 1]

        const weekActs = activities.filter(a => {
          const s = parseLocalDate(a.start_date); const e = parseLocalDate(a.end_date)
          return s <= weekEnd && e >= weekStart
        })

        const numRows = weekActs.length > 0 ? Math.max(...weekActs.map(a => (actRow[a.id] ?? 0) + 1)) : 0
        const weekH = Math.max(MIN_H, DAY_NUM_H + numRows * (ROW_H + ROW_GAP) + 10)

        return (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid #e8e8e8' : 'none', height: weekH, position: 'relative' }}>
            {/* Day cells */}
            {week.map((date, di) => {
              const isToday = date ? isSameDay(date, today) : false
              const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false
              return (
                <div key={di} style={{
                  borderRight: di < 6 ? '1px solid #e8e8e8' : 'none',
                  background: isWeekend ? '#f9f9f9' : '#fff',
                  height: '100%',
                }}>
                  {date && (
                    <div style={{
                      width: 28, height: 28,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '4px auto 0',
                      borderRadius: '50%',
                      background: isToday ? '#f15922' : 'transparent',
                      boxShadow: isToday ? '0 2px 8px rgba(241,89,34,0.35)' : 'none',
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: isToday ? '#fff' : isWeekend ? '#ccc' : '#aaa',
                      fontFamily: 'Montserrat',
                    }}>
                      {date.getDate()}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Activity bars */}
            {weekActs.map(act => {
              const cat = getCat(act)
              const viaje = isViaje(act)
              const congreso = isCongreso(act)
              const cursoDM = isCursoDM(act)
              const actStart = parseLocalDate(act.start_date)
              const actEnd = parseLocalDate(act.end_date)
              const startsThisWeek = actStart >= weekStart
              const endsThisWeek = actEnd <= weekEnd

              let startCol = 0, endCol = 6
              for (let i = 0; i < 7; i++) {
                const d = week[i]; if (!d) continue
                if (isSameDay(d, actStart) || (!startsThisWeek && isSameDay(d, weekStart))) startCol = i
                if (isSameDay(d, actEnd) || (!endsThisWeek && isSameDay(d, weekEnd))) endCol = i
              }

              const row = actRow[act.id] ?? 0
              const top = DAY_NUM_H + row * (ROW_H + ROW_GAP)

              const borderW = congreso ? 2.5 : 2
              const bgOpacity = cursoDM ? '28' : viaje ? 'cc' : '18'
              const bgColor = viaje ? cat.color : `${cat.color}${bgOpacity}`

              const label = viaje
                ? `✈  ${act.vendedor || act.name}${act.location ? '  —  ' + act.location : ''}`
                : act.name + (act.dictante ? '  ·  ' + act.dictante : '')

              return (
                <div
                  key={act.id}
                  className={`cal-bar${viaje ? ' viaje-bar' : ''}`}
                  onClick={() => setSelected(act)}
                  onMouseEnter={e => setTooltip({ act, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: 'absolute',
                    top,
                    left: `calc(${startCol / 7 * 100}% + ${startsThisWeek ? 3 : 0}px)`,
                    right: `calc(${(6 - endCol) / 7 * 100}% + ${endsThisWeek ? 3 : 0}px)`,
                    height: ROW_H,
                    background: bgColor,
                    borderTop: `${borderW}px solid ${cat.color}`,
                    borderBottom: `${borderW}px solid ${cat.color}`,
                    borderLeft: startsThisWeek ? `${borderW}px solid ${cat.color}` : 'none',
                    borderRight: endsThisWeek ? `${borderW}px solid ${cat.color}` : 'none',
                    borderRadius: startsThisWeek && endsThisWeek ? 6 : startsThisWeek ? '6px 0 0 6px' : endsThisWeek ? '0 6px 6px 0' : 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 7,
                    paddingRight: 4,
                    zIndex: congreso ? 12 : viaje ? 11 : 10,
                    boxSizing: 'border-box',
                    boxShadow: congreso ? `0 2px 8px ${cat.color}40` : viaje ? `0 1px 6px ${cat.color}50` : 'none',
                  }}
                >
                  <span style={{
                    fontSize: viaje ? 11.5 : 10.5,
                    fontFamily: 'Barlow Condensed',
                    fontWeight: viaje ? 800 : congreso ? 700 : 600,
                    color: viaje ? '#fff' : cursoDM ? cat.color : cat.color,
                    letterSpacing: 0.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: viaje ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                  }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: Math.min(tooltip.x + 12, window.innerWidth - 260),
          top: tooltip.y - 10,
          background: '#f0f0f0',
          color: '#222',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 12,
          fontFamily: 'Barlow',
          zIndex: 200,
          pointerEvents: 'none',
          maxWidth: 250,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          border: `1px solid ${getCat(tooltip.act).color}40`,
        }}>
          <div style={{ fontWeight: 700, fontFamily: 'Montserrat', fontSize: 13, marginBottom: 4, color: getCat(tooltip.act).color }}>
            {isViaje(tooltip.act) ? '✈ ' : ''}{tooltip.act.name}
          </div>
          <div style={{ color: '#888', fontSize: 11 }}>
            {tooltip.act.start_date === tooltip.act.end_date
              ? formatDate(tooltip.act.start_date)
              : `${formatDate(tooltip.act.start_date)} → ${formatDate(tooltip.act.end_date)}`}
          </div>
          {tooltip.act.location && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>📍 {tooltip.act.location}</div>}
          {tooltip.act.dictante && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>👤 {tooltip.act.dictante}</div>}
        </div>
      )}

      {/* Modal */}
      {selected && (() => {
        const cat = getCat(selected)
        const viaje = isViaje(selected)
        const congreso = isCongreso(selected)
        const dias = diffDays(selected.start_date, selected.end_date)
        return (
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff',
              borderRadius: 20,
              padding: 32,
              maxWidth: 440,
              width: '100%',
              position: 'relative',
              boxShadow: '0 24px 80px rgba(0,0,0,0.14)',
              borderTop: `4px solid ${cat.color}`,
            }}>
              {/* Category badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cat.color}12`, border: `1px solid ${cat.color}35`, borderRadius: 20, padding: '4px 12px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                  <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, color: cat.color, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {viaje ? '✈ ' : ''}{cat.name}
                  </span>
                </div>
                {dias > 1 && (
                  <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{dias} días</span>
                )}
                {viaje && dias === 1 && (
                  <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'Barlow Condensed' }}>Ida y vuelta</span>
                )}
              </div>

              <h2 style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Montserrat', color: '#111', marginBottom: 22, lineHeight: 1.2 }}>{selected.name}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Fechas', value: selected.start_date === selected.end_date ? formatDate(selected.start_date) : `${formatDate(selected.start_date)} → ${formatDate(selected.end_date)}` },
                  { label: viaje ? 'Destino' : 'Lugar', value: selected.location || '—' },
                  { label: 'Vendedor', value: selected.vendedor || '—' },
                  ...(selected.dictante && !viaje ? [{ label: 'Dictante', value: selected.dictante }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', color: '#bbb', letterSpacing: 1.5, textTransform: 'uppercase', minWidth: 64, paddingTop: 2, flexShrink: 0, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontSize: 14, color: '#333', fontFamily: 'Barlow', lineHeight: 1.4 }}>{value}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 18, right: 18, background: '#f5f5f5', border: '1px solid #e8e8e8', color: '#aaa', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
