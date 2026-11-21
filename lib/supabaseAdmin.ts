'use client'
import { createClient } from '@supabase/supabase-js'

// Cliente para el panel de admin. Tiene la misma forma que el cliente normal
// (supabase.from('x').select()...), pero cada consulta va a /api/sb, que valida la
// sesión de admin y usa la clave privada en el servidor. Así las tablas pueden tener RLS.
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

export const SESION_KEY = 'cal_dm_admin_auth_v2'

// Si la sesión del servidor venció, se vuelve a pedir la clave.
const fetchAdmin: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined' && localStorage.getItem(SESION_KEY) !== null) {
    localStorage.removeItem(SESION_KEY)
    window.location.reload()
  }
  return res
}

export const supabaseAdmin = createClient(origin + '/api/sb', 'admin-proxy', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchAdmin },
})

export function cerrarSesionAdmin() {
  return fetch('/api/admin-login', { method: 'DELETE' }).catch(() => null)
}
