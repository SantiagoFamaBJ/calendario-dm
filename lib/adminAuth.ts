// Sesión de admin del lado del servidor (cookie httpOnly firmada con la clave).
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'dm_admin'
const enc = new TextEncoder()

// Solo DM_ADMIN_PASSWORD (variable compartida de Vercel). Sin valor por defecto: si falta, nadie entra.
export function adminPassword(): string {
  return (process.env.DM_ADMIN_PASSWORD || '').trim()
}

export function safeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// El token deriva de la clave pero no la revela. Cambiar la clave cierra todas las sesiones.
export async function adminToken(): Promise<string | null> {
  const pass = adminPassword()
  return pass ? hmac(pass, 'calendario-admin-v1') : null
}

export async function isAdmin(): Promise<boolean> {
  const token = await adminToken()
  const jar = await cookies()
  return !!token && safeEqual(jar.get(ADMIN_COOKIE)?.value, token)
}

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
}
