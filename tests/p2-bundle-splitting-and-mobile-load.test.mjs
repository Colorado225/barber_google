import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeBuildDirectory,
  DEFAULT_BUNDLE_BUDGETS,
  extractCriticalAssetsFromHtml,
  measureThrottledInitialLoad,
} from '../scripts/measure-bundles.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

test('router, App, ErpLayout et AdminDashboard utilisent lazy() et Suspense pour le découpage', () => {
  const routerSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/router.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
  const erpSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/erp/ErpLayout.tsx'), 'utf8');
  const erpWorkspaceSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/erp/layout/ErpWorkspace.tsx'),
    'utf8',
  );
  const adminSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/admin/AdminDashboard.tsx'), 'utf8');

  assert.match(routerSrc, /Suspense/);
  assert.match(routerSrc, /lazyNamed\(\s*\(\) => import\('\.\/components\/erp\/ErpLayout'\)/);
  assert.match(routerSrc, /lazyNamed\(\s*\(\) => import\('\.\/components\/admin\/AdminDashboard'\)/);
  assert.match(routerSrc, /lazyNamed\(\s*\(\) => import\('\.\/components\/marketplace\/BookingPortalView'\)/);
  assert.doesNotMatch(routerSrc, /import \{ DashboardView \} from/);

  assert.match(appSrc, /Suspense/);
  assert.match(appSrc, /lazyNamed\(\s*\(\) => import\('\.\/components\/marketplace\/SalonDetailModal'\)/);

  // Les vues lazy et le Suspense vivent désormais dans l'espace de travail extrait.
  assert.match(erpSrc, /ErpWorkspace/);
  assert.match(erpWorkspaceSrc, /Suspense/);
  assert.match(erpWorkspaceSrc, /lazyNamed\(\s*\(\) => import\('\.\.\/DashboardView'\)/);
  assert.match(erpWorkspaceSrc, /lazyNamed\(\s*\(\) => import\('\.\.\/SalonQrCodeView'\)/);
  assert.match(erpWorkspaceSrc, /lazyNamed\(\s*\(\) => import\('\.\.\/NotificationsView'\)/);
  assert.doesNotMatch(erpWorkspaceSrc, /import \{ AppointmentsCalendarView \}/);

  assert.match(adminSrc, /Suspense/);
  assert.match(adminSrc, /lazyNamed\(\s*\(\) => import\('\.\/AdminOverviewPanel'\)/);
  assert.match(adminSrc, /lazyNamed\(\s*\(\) => import\('\.\/SalonManagement'\)/);
});

test('analyzeBuildDirectory détecte les régressions de poids ou les fuites de chunks lazy', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barber-perf-test-'));
  const assetsDir = path.join(tmpDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  try {
    fs.writeFileSync(
      path.join(tmpDir, 'index.html'),
      `<!doctype html><html><head>
        <script type="module" src="/assets/index-entry.js"></script>
        <link rel="modulepreload" href="/assets/ErpLayout-leaked.js">
        <link rel="stylesheet" href="/assets/index-style.css">
      </head><body></body></html>`,
    );

    // Chunks factices : ErpLayout fuit vers index.html et un chunk dépasse 500 kB.
    fs.writeFileSync(path.join(assetsDir, 'index-entry.js'), 'console.log("ok");');
    fs.writeFileSync(path.join(assetsDir, 'ErpLayout-leaked.js'), 'console.log("erp");');
    fs.writeFileSync(path.join(assetsDir, 'index-style.css'), 'body{color:#fff;}');
    fs.writeFileSync(path.join(assetsDir, 'huge-chunk.js'), 'x'.repeat(510_000));

    const result = analyzeBuildDirectory(tmpDir);
    assert.equal(result.ok, false);
    assert.ok(result.lazyIsolation.leakedToInitial.includes('ErpLayout-'));
    assert.ok(result.violations.some((msg) => msg.includes('exceeds')));
    assert.ok(result.violations.some((msg) => msg.includes('leaked into initial load')));
    assert.ok(result.violations.some((msg) => msg.includes('Expected lazy chunks missing')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('measureThrottledInitialLoad simule un téléphone sur réseau 3G lent et vérifie le chargement initial', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barber-throttle-test-'));
  const assetsDir = path.join(tmpDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  try {
    fs.writeFileSync(
      path.join(tmpDir, 'index.html'),
      `<!doctype html><html><head>
        <script type="module" src="/assets/index-app.js"></script>
        <link rel="modulepreload" href="/assets/vendor-react.js">
        <link rel="stylesheet" href="/assets/index-app.css">
      </head><body><div id="root"></div></body></html>`,
    );
    fs.writeFileSync(path.join(assetsDir, 'index-app.js'), 'console.log("app");'.repeat(100));
    fs.writeFileSync(path.join(assetsDir, 'vendor-react.js'), 'console.log("react");'.repeat(200));
    fs.writeFileSync(path.join(assetsDir, 'index-app.css'), '.a{color:gold}'.repeat(80));
    fs.writeFileSync(path.join(assetsDir, 'AdminDashboard-lazy.js'), 'console.log("admin");');
    fs.writeFileSync(path.join(assetsDir, 'ErpLayout-lazy.js'), 'console.log("erp");');
    fs.writeFileSync(path.join(assetsDir, 'BookingPortalView-lazy.js'), 'console.log("booking");');
    fs.writeFileSync(path.join(assetsDir, 'SalonDetailModal-lazy.js'), 'console.log("modal");');
    fs.writeFileSync(path.join(assetsDir, 'SalonQrCodeView-lazy.js'), 'console.log("qr");');
    fs.writeFileSync(path.join(assetsDir, 'EditorialSalonLayout-lazy.js'), 'console.log("motion");');
    fs.writeFileSync(path.join(assetsDir, 'api-lazy.js'), 'console.log("api");');

    const analysis = analyzeBuildDirectory(tmpDir, {
      ...DEFAULT_BUNDLE_BUDGETS,
      requiredLazyChunkPrefixes: ['AdminDashboard-', 'ErpLayout-', 'BookingPortalView-'],
    });
    assert.equal(analysis.ok, true, `Budget violations: ${analysis.violations.join('; ')}`);

    const critical = extractCriticalAssetsFromHtml(fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf8'));
    assert.equal(critical.scripts.length, 2);
    assert.equal(critical.stylesheets.length, 1);

    const throttled = await measureThrottledInitialLoad(tmpDir, {
      rttMs: 120,
      bytesPerSec: 50_000, // 400 kbps (3G lente)
    });

    assert.equal(throttled.requestCount, 4);
    assert.ok(throttled.totalDurationMs >= 200, 'Doit refléter la latence réseau simulée');
    assert.ok(!throttled.requestedPaths.some((p) => p.includes('AdminDashboard')));
    assert.ok(!throttled.requestedPaths.some((p) => p.includes('ErpLayout')));
    assert.ok(!throttled.requestedPaths.some((p) => p.includes('BookingPortalView')));
    assert.ok(!throttled.requestedPaths.some((p) => p.includes('SalonQrCodeView')));
    assert.ok(!throttled.requestedPaths.some((p) => p.includes('EditorialSalonLayout')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('si dist/ est présent localement, le build réel respecte tous les budgets P2 et le test mobile 3G lente', async (t) => {
  const distDir = path.join(ROOT_DIR, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    t.skip('dist/ non généré avant build (vérifié dans CI après npm run build)');
    return;
  }

  const metrics = analyzeBuildDirectory(distDir);
  assert.equal(metrics.ok, true, `Régressions bundle : ${metrics.violations.join(' | ')}`);
  assert.equal(metrics.lazyIsolation.leakedToInitial.length, 0);
  assert.equal(metrics.lazyIsolation.missing.length, 0);

  const throttled = await measureThrottledInitialLoad(distDir, {
    rttMs: 250,
    bytesPerSec: 50_000, // 400 kbps Slow 3G sur mobile
  });
  assert.ok(throttled.totalWireBytes < DEFAULT_BUNDLE_BUDGETS.maxInitialTotalGzipBytes);
  assert.ok(throttled.totalDurationMs < 8000);
  assert.ok(
    !throttled.requestedPaths.some((p) =>
      /(ErpLayout|AdminDashboard|SalonQrCodeView|EditorialSalonLayout|BookingPortalView|SalonDetailModal|api-)/.test(
        p,
      ),
    ),
    'Aucun chunk ERP, Admin, Motion ou QRCode ne doit être téléchargé au chargement initial /',
  );
});
