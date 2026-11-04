import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';

type Environment = Record<string, string | undefined>;
export function isHosted(env: Environment = process.env) {
  return env.LIFE_GARDEN_HOSTED === '1' || Boolean(env.RAILWAY_PROJECT_ID);
}

export function hostedConfigurationError(env: Environment = process.env) {
  if (!isHosted(env)) return null;
  if (!env.LIFE_GARDEN_USERNAME || !/^[A-Za-z0-9_.-]{1,80}$/.test(env.LIFE_GARDEN_USERNAME))
    return 'Configure a valid LIFE_GARDEN_USERNAME.';
  if (env.LIFE_GARDEN_PASSWORD_SCRYPT) {
    if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.LIFE_GARDEN_PASSWORD_SCRYPT))
      return 'Configure a valid LIFE_GARDEN_PASSWORD_SCRYPT.';
  } else if (!/^[a-f0-9]{64}$/.test(env.LIFE_GARDEN_PASSWORD_SHA256 || '')) {
    return 'Configure LIFE_GARDEN_PASSWORD_SCRYPT.';
  }
  try {
    const url = new URL(env.LIFE_GARDEN_ORIGIN || '');
    if (url.protocol !== 'https:' || url.origin !== env.LIFE_GARDEN_ORIGIN)
      return 'LIFE_GARDEN_ORIGIN must be an HTTPS origin without a trailing slash.';
  } catch {
    return 'Configure LIFE_GARDEN_ORIGIN.';
  }
  return null;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

// Both the page boundary and data API enforce access. Hosting never bypasses
// authentication based on a caller-controlled Host or forwarded header.
export function accessError(request: Request, env: Environment = process.env): Response | null {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isHosted(env)) {
    const host = request.headers.get('host') || new URL(request.url).host;
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
      ? null
      : Response.json({ error: 'Local access only.' }, { status: 403, headers });
  }
  if (hostedConfigurationError(env))
    return Response.json({ error: 'Hosted access is not configured.' }, { status: 503, headers });
  const authorization = request.headers.get('authorization') || '';
  if (/^Basic [A-Za-z0-9+/]+=*$/i.test(authorization) && authorization.length < 2048) {
    const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = credentials.indexOf(':');
    const username = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);
    const userMatches = timingSafeEqual(digest(username), digest(env.LIFE_GARDEN_USERNAME!));
    let passwordMatches: boolean;
    if (env.LIFE_GARDEN_PASSWORD_SCRYPT) {
      const [salt, hash] = env.LIFE_GARDEN_PASSWORD_SCRYPT.split(':');
      passwordMatches = timingSafeEqual(
        scryptSync(password, Buffer.from(salt, 'hex'), 64, { N: 32768, maxmem: 64 * 1024 * 1024 }),
        Buffer.from(hash, 'hex'),
      );
    } else {
      // Compatibility for existing deployments using a generated 256-bit password.
      passwordMatches = timingSafeEqual(
        digest(password),
        Buffer.from(env.LIFE_GARDEN_PASSWORD_SHA256!, 'hex'),
      );
    }
    if (separator > 0 && userMatches && passwordMatches) return null;
  }
  return Response.json(
    { error: 'Sign in to your private Life Garden.' },
    {
      status: 401,
      headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Life Garden", charset="UTF-8"' },
    },
  );
}

export function sameOrigin(request: Request, env: Environment = process.env) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') return false;
  const expected = isHosted(env) ? env.LIFE_GARDEN_ORIGIN : new URL(request.url).origin;
  // Browser writes must carry their origin; CLI reads may omit it.
  if (request.method !== 'GET' && request.method !== 'HEAD' && !origin) return false;
  return !origin || origin === expected;
}
