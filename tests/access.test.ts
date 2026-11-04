import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { accessError, hostedConfigurationError, sameOrigin } from '../src/lib/access';

const env = {
  LIFE_GARDEN_HOSTED: '1',
  LIFE_GARDEN_USERNAME: 'garden',
  LIFE_GARDEN_PASSWORD_SHA256: createHash('sha256').update('random-test-password').digest('hex'),
  LIFE_GARDEN_ORIGIN: 'https://garden.example.com',
};
function request(password?: string, extra: Record<string, string> = {}) {
  return new Request('https://garden.example.com/api/state', {
    headers: {
      ...extra,
      ...(password
        ? {
            authorization: `Basic ${Buffer.from(`garden:${password}`).toString('base64')}`,
          }
        : {}),
    },
  });
}
test('hosted access requires authentication even with spoofed local host headers', () => {
  const spoofHeaders: Record<string, string>[] = [
    {},
    { host: 'localhost:3000' },
    { 'x-forwarded-host': '127.0.0.1' },
  ];
  for (const headers of spoofHeaders) {
    assert.equal(accessError(request(undefined, headers), env)?.status, 401);
  }
  assert.equal(accessError(request('wrong'), env)?.status, 401);
  assert.equal(accessError(request('random-test-password'), env), null);
  assert.equal(
    accessError(request('random-test-password'), { ...env, LIFE_GARDEN_USERNAME: 'other' })?.status,
    401,
  );
  for (const authorization of ['Basic malformed', 'Bearer token', 'Basic Og==']) {
    assert.equal(accessError(request(undefined, { authorization }), env)?.status, 401);
  }
});
test('hosted mode fails closed for missing or invalid configuration', () => {
  for (const patch of [
    { LIFE_GARDEN_PASSWORD_SHA256: '' },
    { LIFE_GARDEN_USERNAME: '' },
    { LIFE_GARDEN_ORIGIN: 'http://garden.example.com' },
    { LIFE_GARDEN_ORIGIN: 'https://garden.example.com/another' },
  ]) {
    assert.ok(hostedConfigurationError({ ...env, ...patch }));
    assert.equal(accessError(request('random-test-password'), { ...env, ...patch })?.status, 503);
  }
  assert.equal(accessError(request(), { RAILWAY_PROJECT_ID: 'project' })?.status, 503);
});
test('cross-origin reads and writes are rejected, including authenticated browser writes', () => {
  assert.equal(sameOrigin(request(), env), true);
  assert.equal(sameOrigin(request(undefined, { origin: 'https://evil.example' }), env), false);
  assert.equal(sameOrigin(request(undefined, { 'sec-fetch-site': 'cross-site' }), env), false);
  const write = (origin?: string) =>
    new Request('https://garden.example.com/api/state', {
      method: 'PUT',
      headers: origin ? { origin } : {},
    });
  assert.equal(sameOrigin(write(), env), false);
  assert.equal(sameOrigin(write('https://evil.example'), env), false);
  assert.equal(sameOrigin(write(env.LIFE_GARDEN_ORIGIN), env), true);
});
test('local installation remains restricted to loopback', () => {
  assert.equal(accessError(new Request('http://127.0.0.1:3000/api/state'), {}), null);
  assert.equal(accessError(new Request('https://garden.example.com/api/state'), {})?.status, 403);
});
test('salted scrypt authentication takes precedence over a legacy password hash', () => {
  const salt = Buffer.alloc(16, 1);
  const hash = scryptSync('chosen-test-password', salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const configured = {
    ...env,
    LIFE_GARDEN_PASSWORD_SCRYPT: `${salt.toString('hex')}:${hash.toString('hex')}`,
  };
  assert.equal(accessError(request('chosen-test-password'), configured), null);
  assert.equal(accessError(request('random-test-password'), configured)?.status, 401);
  assert.equal(accessError(request('incorrect'), configured)?.status, 401);
  assert.equal(
    accessError(request('chosen-test-password'), {
      ...configured,
      LIFE_GARDEN_PASSWORD_SCRYPT: 'invalid',
    })?.status,
    503,
  );
});
