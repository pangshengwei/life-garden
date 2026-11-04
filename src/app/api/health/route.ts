import { getStore } from '@/lib/database';
import { hostedConfigurationError } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (hostedConfigurationError()) return Response.json({ status: 'unavailable' }, { status: 503 });
  try {
    getStore().read();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
