'use client'

import { useState } from 'react'
import { Activity, ActivityType } from '@/lib/supabase'

interface Props {
  activities: Activity[]
  currentDate: Date
}

const TYPE_CONFIG: Record<ActivityType, { color: string; bg: string; border: string; label: string }> = {
  viaje:         { color: '#10b981', bg: 'rgba(5,150,105,0.18)',   border: '#059669', label: 'Viaje' },
  curso_dm:      { color: '#f15922', bg: 'rgba(241,89,34,0.18)',   border: '#f15922', label: 'Curso DM' },
  curso_externo: { color: '#3b82f6', bg: 'rgba(37,99,235,0.18)',   border: '#2563eb', label: 'Curso externo' },
  congreso:      { color: '#8b5cf6', bg: 'rgba(124,58,237,0.18)', border: '#7c3aed', label: 'Congreso' },
}

const TYPE_ORDER: ActivityType[] = ['viaje', 'curso_dm', 'curso_externo', 'congreso']

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
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' })
}

export default function CalendarView({ activities, currentDate }: Props) {
  const [selected, setSelected] = useState<Activity | null>(null)

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
    return activities
      .filter(a => isInRange(date, parseLocalDate(a.start_date), parseLocalDate(a.end_date)))
      .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', padding: '8px 8px 0' }}>
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: 1, color: 'var(--text-muted)', padding: '4px 0 8px', fontWeight: 600, textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>

      <div style={{ padding: '0 8px' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 90 }}>
            {week.map((date, di) => {
              const isToday = date && isSameDay(date, today)
              const isWeekend = date && (date.getDay() === 0 || date.getDay() === 6)
              const dayActivities = date ? getActivitiesForDay(date) : []

              return (
                <div key={di} style={{ borderRight: di < 6 ? '1px solid var(--border)' : 'none', padding: '6px 0', minHeight: 90, background: isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  {date && (
                    <>
                      <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', borderRadius: '50%', background: isToday ? 'var(--orange)' : 'transparent', fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : isWeekend ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'Montserrat' }}>
                        {date.getDate()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px' }}>
                        {dayActivities.map(act => {
                          const cfg = TYPE_CONFIG[act.type]
                          const start = parseLocalDate(act.start_date)
                          const end = parseLocalDate(act.end_date)
                          const isStart = isSameDay(start, date) || date.getDay() === 1
                          const isEnd = isSameDay(end, date) || date.getDay() === 0
                          const realStart = isSameDay(start, date)
                          const showLabel = realStart || date.getDay() === 1

                          return (
                            <button key={act.id} onClick={() => setSelected(act)}
                              style={{ display: 'block', width: '100%', background: cfg.bg, border: 'none', borderTop: `2px solid ${cfg.border}`, borderBottom: `2px solid ${cfg.border}`, borderLeft: isStart ? `2px solid ${cfg.border}` : 'none', borderRight: isEnd ? `2px solid ${cfg.border}` : 'none', borderRadius: isStart && isEnd ? 6 : isStart ? '6px 0 0 6px' : isEnd ? '0 6px 6px 0' : 0, padding: '2px 4px', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', minHeight: 22 }}
                              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.3)')}
                              onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>
                              {showLabel && (
                                <span style={{ fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 600, color: cfg.color, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                  {act.type === 'viaje' ? '✈ ' : ''}{act.name}
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

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: `1px solid ${TYPE_CONFIG[selected.type].border}`, borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: TYPE_CONFIG[selected.type].bg, border: `1px solid ${TYPE_CONFIG[selected.type].border}`, borderRadius: 20, padding: '3px 10px', marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_CONFIG[selected.type].color }} />
              <span style={{ fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 600, color: TYPE_CONFIG[selected.type].color, letterSpacing: 1, textTransform: 'uppercase' }}>
                {selected.type === 'viaje' ? '✈ ' : ''}{TYPE_CONFIG[selected.type].label}
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Montserrat', color: 'var(--text)', marginBottom: 16, lineHeight: 1.2 }}>{selected.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Fechas', value: selected.start_date === selected.end_date ? formatDate(selected.start_date) : `${formatDate(selected.start_date)} → ${formatDate(selected.end_date)}` },
                { label: 'Lugar', value: selected.location },
                { label: 'Vendedor', value: selected.vendedor },
                ...(selected.dictante ? [{ label: 'Dictante', value: selected.dictante }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontFamily: 'Barlow Condensed', color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', minWidth: 64, paddingTop: 2 }}>{label}</span>
                  <span style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'Barlow', flex: 1 }}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>
      )}
    </>
  )
}
