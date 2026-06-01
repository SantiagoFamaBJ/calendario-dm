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
    return catMap[act.category_slug] || catMap[act.type] || { color: '#666', name: act.category_slug || act.type, slug: '' }
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

  function getActivitiesForDay(date: Date): Activity[] {
    const catOrder = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
    return activities
      .filter(a => isInRange(date, parseLocalDate(a.start_date), parseLocalDate(a.end_date)))
      .sort((a, b) => {
        const ao = catOrder[a.category_slug] ?? catOrder[a.type] ?? 99
        const bo = catOrder[b.category_slug] ?? catOrder[b.type] ?? 99
        return ao - bo
      })
  }

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontFamily: 'Barlow Condensed', letterSpacing: 1.5,
            color: i >= 5 ? 'var(--text-dim)' : 'var(--text-muted)',
            padding: '8px 0', fontWeight: 600, textTransform: 'uppercase',
            borderRight: i < 6 ? '1px solid var(--border)' : 'none',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 110 }}>
            {week.map((date, di) => {
              const isToday = date ? isSameDay(date, today) : false
              const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false
              const isOtherMonth = !date
              const dayActivities = date ? getActivitiesForDay(date) : []

              return (
                <div key={di} style={{
                  borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                  padding: '6px 0 4px',
                  minHeight: 110,
                  background: isOtherMonth ? 'transparent' : isWeekend ? 'rgba(255,255,255,0.008)' : 'transparent',
                  position: 'relative',
                }}>
                  {date && (
                    <>
                      <div style={{
                        width: 24, height: 24,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 5px',
                        borderRadius: '50%',
                        background: isToday ? 'var(--orange)' : 'transparent',
                        fontSize: 12,
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? '#fff' : isWeekend ? 'var(--text-dim)' : 'var(--text-muted)',
                        fontFamily: 'Montserrat',
                      }}>
                        {date.getDate()}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px' }}>
                        {dayActivities.map(act => {
                          const cat = getCat(act)
                          const start = parseLocalDate(act.start_date)
                          const end = parseLocalDate(act.end_date)
                          const isStart = isSameDay(start, date) || date.getDay() === 1
                          const isEnd = isSameDay(end, date) || date.getDay() === 0
                          const realStart = isSameDay(start, date)
                          const showLabel = realStart || date.getDay() === 1
                          const isViaje = act.category_slug === 'viaje' || act.type === 'viaje'

                          return (
                            <button
                              key={act.id}
                              onClick={() => setSelected(act)}
                              style={{
                                display: 'block', width: '100%',
                                background: `${cat.color}1a`,
                                border: 'none',
                                borderTop: `1.5px solid ${cat.color}`,
                                borderBottom: `1.5px solid ${cat.color}`,
                                borderLeft: isStart ? `1.5px solid ${cat.color}` : 'none',
                                borderRight: isEnd ? `1.5px solid ${cat.color}` : 'none',
                                borderRadius: isStart && isEnd ? 5 : isStart ? '5px 0 0 5px' : isEnd ? '0 5px 5px 0' : 0,
                                padding: '2px 5px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                minHeight: 20,
                                transition: 'filter 0.1s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.4)' }}
                              onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                            >
                              {showLabel && (
                                <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 600, color: cat.color, letterSpacing: 0.2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {isViaje ? '✈ ' : ''}{act.name}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {selected && (() => {
        const cat = getCat(selected)
        const isViaje = selected.category_slug === 'viaje' || selected.type === 'viaje'
        return (
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#131313', border: `1px solid ${cat.color}40`, borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', position: 'relative', boxShadow: `0 0 40px ${cat.color}20` }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cat.color}18`, border: `1px solid ${cat.color}50`, borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, color: cat.color, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {isViaje ? '✈ ' : ''}{cat.name}
                </span>
              </div>

              <h2 style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Montserrat', color: '#f0f0f0', marginBottom: 20, lineHeight: 1.25 }}>{selected.name}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Fechas', value: selected.start_date === selected.end_date ? formatDate(selected.start_date) : `${formatDate(selected.start_date)} → ${formatDate(selected.end_date)}` },
                  { label: 'Lugar', value: selected.location || '—' },
                  { label: 'Vendedor', value: selected.vendedor || '—' },
                  ...(selected.dictante ? [{ label: 'Dictante', value: selected.dictante }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', minWidth: 60, paddingTop: 3, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 14, color: '#d0d0d0', fontFamily: 'Barlow', lineHeight: 1.4 }}>{value}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 16, right: 16, background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#666', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
