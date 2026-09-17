import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
const content = template
  .replaceAll('__LOCAL_DATABASE_PASSWORD__', randomBytes(24).toString('hex'))
  .replaceAll('__LOCAL_CARD_KEY__', randomBytes(32).toString('hex'));

try {
  await writeFile(new URL('../.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a unique local database password.');
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
    const envUrl = new URL('../.env', import.meta.url);
    const existing = await readFile(envUrl, 'utf8');
    if (!/^CARD_ENCRYPTION_KEY=/m.test(existing)) {
      await writeFile(
        envUrl,
        `${existing.trimEnd()}\nCARD_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`,
        { mode: 0o600 },
      );
      console.log('Added a local synthetic-card encryption key; preserved existing configuration.');
    } else console.log('.env already exists; kept your configuration.');
  } else {
    throw error;
  }
}
