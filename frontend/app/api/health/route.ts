import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const backend = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  try {
    // Render cold starts may take considerably longer than ordinary API calls.
    const response = await fetch(`${backend}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) return NextResponse.json({ok:false, backendStatus:response.status}, {status:503});
    const payload = await response.json();
    if (payload?.ok !== true) return NextResponse.json({ok:false}, {status:503});
    return NextResponse.json({ok:true}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ok:false, reason:'backend_unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
