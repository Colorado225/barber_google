import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Ce garde-fou empêche qu'un déclenchement manuel applique un historique divergent.
test('le workflow de migrations reste bloqué avant la connexion ou le push', () => {
  const workflow = readFileSync('.github/workflows/supabase-migrations.yml', 'utf8');
  const guard = workflow.indexOf("name: Bloquer les migrations jusqu'à réconciliation");
  const failure = workflow.indexOf('exit 1', guard);
  const link = workflow.indexOf('supabase link --project-ref');
  const push = workflow.indexOf('supabase db push --remote --skip-vault --yes');
  assert.ok(guard >= 0 && failure > guard && link > failure && push > link);
});
