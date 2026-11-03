import { ConflictError, getStore } from '@/lib/database';
import { dataSchema } from '@/lib/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function allowed(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  const origin = request.headers.get('origin');
  return !origin || origin === `${url.protocol}//${host}`;
}
export async function GET(request: Request) {
  if (!allowed(request)) return Response.json({ error: 'Local access only.' }, { status: 403 });
  try {
    const store = getStore();
    const current = store.read();
    return Response.json(
      {
        ...current,
        mirrorError: store.mirror(current.data),
        mirrorPath: store.mirrorPath,
        dbPath: store.dbPath,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'Could not open your local database.' }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  if (!allowed(request)) return Response.json({ error: 'Local access only.' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'JSON required.' }, { status: 415 });
  try {
    const body = await request.text();
    if (body.length > 5_000_000)
      return Response.json({ error: 'Backup exceeds the 5 MB limit.' }, { status: 413 });
    const input = JSON.parse(body);
    const result = dataSchema.safeParse(input.data);
    if (!result.success || !Number.isInteger(input.baseRevision) || input.baseRevision < 0)
      return Response.json(
        { error: result.success ? 'Invalid revision.' : result.error.issues[0]?.message },
        { status: 400 },
      );
    return Response.json(getStore().save(result.data, input.baseRevision));
  } catch (e) {
    if (e instanceof ConflictError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof SyntaxError) return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
    return Response.json(
      { error: 'Save failed. Your changes remain in this tab; export a backup before closing.' },
      { status: 500 },
    );
  }
}
