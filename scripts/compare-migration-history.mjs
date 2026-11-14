// Comparaison hors ligne d'un export d'historique Supabase ; aucune connexion ni écriture distante.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function compareMigrationHistory(files, remote) {
  const local = files
    .filter((name) => name.endsWith('.sql'))
    .map((file) => {
      const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(file);
      if (!match) throw new Error(`Nom de migration invalide : ${file}`);
      return { version: match[1], name: match[2] };
    });
  if (!Array.isArray(remote)) throw new Error('L’historique distant doit être un tableau.');
  for (const row of remote) {
    if (
      !row ||
      typeof row.version !== 'string' ||
      !/^\d{14}$/.test(row.version) ||
      typeof row.name !== 'string' ||
      !row.name
    ) {
      throw new Error('Chaque migration distante doit avoir une version à 14 chiffres et un nom.');
    }
  }
  for (const [label, list] of [
    ['local', local],
    ['distant', remote],
  ]) {
    const versions = new Set();
    for (const row of list) {
      if (versions.has(row.version)) throw new Error(`Version ${label} dupliquée : ${row.version}`);
      versions.add(row.version);
    }
  }
  const byVersion = new Map(remote.map((row) => [row.version, row]));
  const localVersions = new Set(local.map((row) => row.version));
  const common = [];
  const collisions = [];
  const localOnly = [];
  for (const item of local) {
    const sameVersion = byVersion.get(item.version);
    if (!sameVersion) localOnly.push(item);
    else if (sameVersion.name === item.name) common.push(item);
    else collisions.push({ version: item.version, localName: item.name, remoteName: sameVersion.name });
  }
  const remoteOnly = remote
    .filter((item) => !localVersions.has(item.version))
    .map(({ version, name }) => ({ version, name }));
  const nameMatches = local.flatMap((l) =>
    remote
      .filter((r) => r.name === l.name && r.version !== l.version)
      .map((r) => ({ name: l.name, localVersion: l.version, remoteVersion: r.version })),
  );
  return { common, collisions, localOnly, remoteOnly, nameMatches };
}

function main() {
  const input = process.argv[2];
  if (!input)
    throw new Error(
      'Usage : node scripts/compare-migration-history.mjs <historique.json> [dossier-migrations]',
    );
  const parsed = JSON.parse(readFileSync(input, 'utf8'));
  const rows = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.rows);
  const result = compareMigrationHistory(readdirSync(process.argv[3] ?? 'supabase/migrations'), rows);
  console.log(JSON.stringify(result, null, 2));
  // Un historique identique en noms et versions ne prouve pas la parité de contenu ou de schéma.
  if (result.collisions.length || result.localOnly.length || result.remoteOnly.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
