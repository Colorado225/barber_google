import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cli = process.platform === 'win32' ? 'node_modules/.bin/supabase.cmd' : 'node_modules/.bin/supabase';

test('la CLI Supabase est verrouillée et les scripts ciblent explicitement le distant', () => {
  assert.equal(pkg.devDependencies.supabase, '3.1.0');
  assert.equal(execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim(), pkg.devDependencies.supabase);
  const pushHelp = execFileSync(cli, ['db', 'push', '--help'], { encoding: 'utf8' });
  const listHelp = execFileSync(cli, ['migration', 'list', '--help'], { encoding: 'utf8' });
  assert.match(pushHelp, /--remote/);
  assert.match(pushHelp, /--skip-vault/);
  assert.match(pushHelp, /--dry-run/);
  assert.match(listHelp, /--remote/);
  assert.match(pkg.scripts['supabase:db:linked:status'], /--remote/);
  assert.match(pkg.scripts['supabase:db:linked:preview'], /--remote --skip-vault --dry-run/);
  assert.match(pkg.scripts['supabase:db:linked:push'], /--remote --skip-vault/);
});
