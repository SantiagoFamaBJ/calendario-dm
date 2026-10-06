import { NextResponse } from 'next/server';

// La clave vive solo en el servidor (variable DM_ADMIN_PASSWORD en Vercel, sin NEXT_PUBLIC_).
const PASSWORD = process.env.DM_ADMIN_PASSWORD || 'dm2026';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const ok = typeof password === 'string' && password.trim() === PASSWORD;
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
