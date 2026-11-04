import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';

// Keep the plaintext password on the owner's Mac, never in Git or build context.
const password = randomBytes(32).toString('base64url');
const salt = randomBytes(16);
const credentials = {
  username: 'garden',
  password,
  passwordScrypt:
    salt.toString('hex') +
    ':' +
    scryptSync(password, salt, 64, {
      N: 32768,
      maxmem: 64 * 1024 * 1024,
    }).toString('hex'),
};
fs.writeFileSync('.deployment-access.json', JSON.stringify(credentials, null, 2) + '\n', {
  mode: 0o600,
  flag: 'wx',
});
console.log(
  'Created private .deployment-access.json (mode 600). Save the password in your password manager.',
);
