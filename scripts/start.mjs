import { spawn } from 'node:child_process';
import path from 'node:path';

const hosted = process.env.LIFE_GARDEN_HOSTED === '1' || Boolean(process.env.RAILWAY_PROJECT_ID);
if (hosted) {
  const env = process.env;
  if (
    !env.LIFE_GARDEN_USERNAME ||
    !/^[a-f0-9]{64}$/.test(env.LIFE_GARDEN_PASSWORD_SHA256 || '') ||
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
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
