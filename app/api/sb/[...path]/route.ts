import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// Puente entre el panel y Supabase: el navegador del admin habla con esta ruta y acá se agrega
// la clave privada (nunca llega al navegador). Solo con sesión de admin y solo estas tablas.
const TABLAS = new Set(['cal_activities', 'cal_categories'])
const REENVIAR = ['content-type', 'accept', 'prefer', 'range', 'range-unit', 'accept-profile', 'content-profile']
const DEVOLVER = ['content-type', 'content-range', 'preference-applied']

async function handler(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel' }, { status: 500 })

  const { path } = await ctx.params
  // Solo la API de tablas: rest/v1/<tabla>
  if (path.length !== 3 || path[0] !== 'rest' || path[1] !== 'v1' || !TABLAS.has(path[2])) {
    return NextResponse.json({ message: 'Operación no permitida' }, { status: 400 })
  }
  // Nunca editar ni borrar sin filtro (evita vaciar una tabla por error)
  const search = new URL(req.url).search
  if ((req.method === 'PATCH' || req.method === 'DELETE') && !/[?&][a-z0-9_]+=/.test(search)) {
    return NextResponse.json({ message: 'Falta filtro' }, { status: 400 })
  }

  const headers = new Headers({ apikey: key, Authorization: 'Bearer ' + key })
  for (const h of REENVIAR) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text()
  const r = await fetch(url + '/rest/v1/' + path[2] + search, { method: req.method, headers, body, cache: 'no-store' })

  const out = new Headers()
  for (const h of DEVOLVER) {
    const v = r.headers.get(h)
    if (v) out.set(h, v)
  }
  return new Response(req.method === 'HEAD' ? null : await r.text(), { status: r.status, headers: out })
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as HEAD }
