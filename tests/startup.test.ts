import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const launcher = path.resolve('scripts/start.mjs');

// A real HTTP child with Next.js's documented signal exit convention lets the
// tests exercise the production launcher without touching the personal database.
async function startFixture(mode = 'graceful') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-garden-startup-'));
  const cli = path.join(dir, 'node_modules/next/dist/bin/next');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(
    cli,
    `
    const http = require('node:http');
    const server = http.createServer((req, res) => {
      if (req.url === '/fail') return process.exit(7);
      process.stdout.write('INFLIGHT\\n');
      setTimeout(() => res.end('request completed'), 200);
    });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
      if (process.env.FIXTURE_MODE === 'fail-on-stop') return process.exit(7);
      if (process.env.FIXTURE_MODE === 'stuck') return;
      server.close(() => process.exit(signal === 'SIGTERM' ? 143 : 130));
    });
    server.listen(0, '127.0.0.1', () => process.stdout.write('READY ' + server.address().port + ' ' + process.pid + '\\n'));
  `,
  );
  const env: NodeJS.ProcessEnv = { ...process.env, LIFE_GARDEN_HOSTED: '0', FIXTURE_MODE: mode };
  delete env.RAILWAY_PROJECT_ID;
  const processHandle = spawn(process.execPath, [launcher], {
    cwd: dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '',
    errors = '';
  processHandle.stdout.on('data', (chunk) => {
    output += chunk;
  });
  processHandle.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  const closed = once(processHandle, 'close');
  async function waitFor(pattern: RegExp) {
    const deadline = Date.now() + 5000;
    while (!pattern.test(output)) {
      if (processHandle.exitCode !== null || Date.now() > deadline)
        throw new Error(`Fixture did not reach ${pattern}: ${output} ${errors}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return output.match(pattern)!;
  }
  const ready = await waitFor(/READY (\d+) (\d+)/);
  const childPid = Number(ready[2]);
  return {
    processHandle,
    closed,
    waitFor,
    url: `http://127.0.0.1:${ready[1]}`,
    childPid,
    output: () => output,
    errors: () => errors,
    cleanup() {
      for (const pid of [childPid, processHandle.pid]) {
        try {
          if (pid) process.kill(pid, 'SIGKILL');
        } catch {
          /* already stopped */
        }
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(
    `requested ${signal} finishes an in-flight HTTP response and exits successfully`,
    { timeout: 10000 },
    async () => {
      const fixture = await startFixture();
      try {
        const response = fetch(fixture.url, { signal: AbortSignal.timeout(5000) });
        await fixture.waitFor(/INFLIGHT/);
        fixture.processHandle.kill(signal);
        await fixture.waitFor(new RegExp(`Received ${signal}`));
        fixture.processHandle.kill(signal); // Duplicate stop signals are harmless.
        assert.equal(await (await response).text(), 'request completed');
        assert.deepEqual(await fixture.closed, [0, null]);
        assert.match(fixture.output(), /Server stopped cleanly/);
        assert.equal(fixture.errors(), '');
      } finally {
        fixture.cleanup();
      }
    },
  );
}

test(
  'an application failure remains a failure during an ordinary run or requested shutdown',
  { timeout: 10000 },
  async () => {
    for (const mode of ['graceful', 'fail-on-stop']) {
      const fixture = await startFixture(mode);
      try {
        if (mode === 'fail-on-stop') fixture.processHandle.kill('SIGTERM');
        else await fetch(fixture.url + '/fail').catch(() => {});
        assert.deepEqual(await fixture.closed, [7, null]);
        assert.doesNotMatch(fixture.output(), /Server stopped cleanly/);
      } finally {
        fixture.cleanup();
      }
    }
  },
);

test(
  'an unrequested signal exit and a forced kill are never reported as clean shutdowns',
  { timeout: 10000 },
  async () => {
    const unexpected = await startFixture();
    try {
      process.kill(unexpected.childPid, 'SIGTERM');
      assert.deepEqual(await unexpected.closed, [143, null]);
    } finally {
      unexpected.cleanup();
    }
    const forced = await startFixture('stuck');
    try {
      forced.processHandle.kill('SIGTERM');
      await forced.waitFor(/Received SIGTERM/);
      process.kill(forced.childPid, 'SIGKILL');
      assert.deepEqual(await forced.closed, [1, null]);
      assert.doesNotMatch(forced.output(), /Server stopped cleanly/);
    } finally {
      forced.cleanup();
    }
  },
);
