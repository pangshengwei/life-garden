import { spawn } from 'node:child_process';
import path from 'node:path';

const hosted = process.env.LIFE_GARDEN_HOSTED === '1' || Boolean(process.env.RAILWAY_PROJECT_ID);
if (hosted) {
  const env = process.env;
  if (
    !env.LIFE_GARDEN_USERNAME ||
    !(env.LIFE_GARDEN_PASSWORD_SCRYPT
      ? /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.LIFE_GARDEN_PASSWORD_SCRYPT)
      : /^[a-f0-9]{64}$/.test(env.LIFE_GARDEN_PASSWORD_SHA256 || '')) ||
    !env.LIFE_GARDEN_ORIGIN?.startsWith('https://') ||
    !env.LIFE_GARDEN_DATA_DIR ||
    !path.isAbsolute(env.LIFE_GARDEN_DATA_DIR)
  ) {
    console.error(
      'Hosted startup requires username, password hash, HTTPS origin and an absolute data directory.',
    );
    process.exit(1);
  }
  if (env.RAILWAY_PROJECT_ID && env.LIFE_GARDEN_DATA_DIR !== env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.error('LIFE_GARDEN_DATA_DIR must match the attached Railway volume mount path.');
    process.exit(1);
  }
}
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    hosted ? '0.0.0.0' : '127.0.0.1',
    '--port',
    process.env.PORT || '3000',
  ],
  { stdio: 'inherit', env: process.env },
);
let shutdownSignal;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (shutdownSignal) return;
    shutdownSignal = signal;
    console.log(`Received ${signal}; waiting for active requests to finish.`);
    child.kill(signal);
  });
}
child.once('error', (error) => {
  console.error('Could not start the server:', error.message);
  process.exitCode = 1;
});
child.once('close', (code, signal) => {
  // Next.js drains requests before exiting 143/130 for SIGTERM/SIGINT.
  // Normalize only a shutdown that this launcher actually requested. Keep
  // unrelated failures and forced kills visible to Railway's crash detection.
  const expectedCode = shutdownSignal === 'SIGTERM' ? 143 : 130;
  const cleanShutdown =
    shutdownSignal && (code === 0 || code === expectedCode || signal === shutdownSignal);
  process.exitCode = cleanShutdown ? 0 : (code ?? 1);
  if (cleanShutdown) console.log('Server stopped cleanly.');
});
