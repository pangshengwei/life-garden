import { ConflictError, getStore } from '@/lib/database';
import { dataSchema } from '@/lib/validation';
import { accessError, isHosted, sameOrigin } from '@/lib/access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const denied = accessError(request);
  if (denied) return denied;
  if (!sameOrigin(request))
    return Response.json({ error: 'Same-origin access required.' }, { status: 403 });
  try {
    const store = getStore();
    const current = store.read();
    return Response.json(
      {
        ...current,
        mirrorError: store.mirror(current.data),
        mirrorPath: store.mirrorPath,
        dbPath: store.dbPath,
        hosted: isHosted(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'Could not open your database.' }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  const denied = accessError(request);
  if (denied) return denied;
  if (!sameOrigin(request))
    return Response.json({ error: 'Same-origin access required.' }, { status: 403 });
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
