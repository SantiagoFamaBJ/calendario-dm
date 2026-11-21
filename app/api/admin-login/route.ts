import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminPassword, adminToken, cookieOptions, safeEqual } from '@/lib/adminAuth'

// La clave vive solo en el servidor (variable DM_ADMIN_PASSWORD en Vercel). Si es correcta,
// deja una cookie httpOnly que habilita /api/sb (lecturas y cambios con la clave privada).
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  const pass = adminPassword()
  const ok = !!pass && typeof password === 'string' && safeEqual(password.trim(), pass)
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600))
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, (await adminToken()) as string, cookieOptions)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { ...cookieOptions, maxAge: 0 })
  return res
}
