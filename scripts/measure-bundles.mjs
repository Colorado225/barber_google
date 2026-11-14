import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const DEFAULT_BUNDLE_BUDGETS = {
  maxAppEntryGzipBytes: 65_000,
  maxInitialJsGzipBytes: 170_000,
  maxInitialCssGzipBytes: 32_000,
  maxInitialTotalGzipBytes: 200_000,
  maxSingleChunkRawBytes: 480_000,
  requiredLazyChunkPrefixes: [
    'AppContext-',
    'ErpLayout-',
    'AdminDashboard-',
    'BookingPortalView-',
    'SalonDetailModal-',
    'SalonQrCodeView-',
    'EditorialSalonLayout-',
    'api-',
  ],
};

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function measureFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const gz = gzipSync(buf, { level: 9 });
  return {
    rawBytes: buf.length,
    gzipBytes: gz.length,
  };
}

export function extractCriticalAssetsFromHtml(html) {
  const scripts = [];
  const stylesheets = [];

  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)) {
    scripts.push(match[1]);
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
    scripts.push(match[1]);
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
    stylesheets.push(match[1]);
  }

  return {
    scripts: [...new Set(scripts)],
    stylesheets: [...new Set(stylesheets)],
  };
}

export function estimateLoadTimeMs({ totalTransferBytes, rttMs, throughputBytesPerSec, requestWaves = 2 }) {
  const networkLatencyMs = requestWaves * rttMs;
  const transferMs = (totalTransferBytes / throughputBytesPerSec) * 1000;
  return Math.round(networkLatencyMs + transferMs);
}

export function analyzeBuildDirectory(
  distDir = path.join(ROOT_DIR, 'dist'),
  budgets = DEFAULT_BUNDLE_BUDGETS,
) {
  const indexHtmlPath = path.join(distDir, 'index.html');
  const assetsDir = path.join(distDir, 'assets');

  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Missing build output: ${indexHtmlPath}. Run "npm run build" first.`);
  }
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Missing assets directory: ${assetsDir}.`);
  }

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const htmlMetrics = measureFile(indexHtmlPath);
  const critical = extractCriticalAssetsFromHtml(indexHtml);

  const assetFiles = fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'));

  const chunks = assetFiles.map((name) => {
    const filePath = path.join(assetsDir, name);
    const { rawBytes, gzipBytes } = measureFile(filePath);
    const ext = name.endsWith('.css') ? 'css' : 'js';
    const webPath = `/assets/${name}`;
    const isInitial = critical.scripts.includes(webPath) || critical.stylesheets.includes(webPath);
    return {
      name,
      webPath,
      ext,
      isInitial,
      rawBytes,
      gzipBytes,
    };
  });

  const jsChunks = chunks.filter((c) => c.ext === 'js');
  const cssChunks = chunks.filter((c) => c.ext === 'css');
  const initialJsChunks = jsChunks.filter((c) => c.isInitial);
  const initialCssChunks = cssChunks.filter((c) => c.isInitial);
  const lazyJsChunks = jsChunks.filter((c) => !c.isInitial);

  const appEntryChunk =
    initialJsChunks.find((c) => c.name.startsWith('index-')) ??
    initialJsChunks.reduce((a, b) => (a.rawBytes > b.rawBytes ? a : b), initialJsChunks[0]);

  const sum = (list, key) => list.reduce((acc, item) => acc + item[key], 0);
  const initialJsRawBytes = sum(initialJsChunks, 'rawBytes');
  const initialJsGzipBytes = sum(initialJsChunks, 'gzipBytes');
  const initialCssRawBytes = sum(initialCssChunks, 'rawBytes');
  const initialCssGzipBytes = sum(initialCssChunks, 'gzipBytes');
  const initialTotalGzipBytes = htmlMetrics.gzipBytes + initialJsGzipBytes + initialCssGzipBytes;

  const largestChunk = jsChunks.reduce(
    (max, chunk) => (chunk.rawBytes > (max?.rawBytes ?? 0) ? chunk : max),
    jsChunks[0] ?? null,
  );

  const lazyChunkPrefixesPresent = [];
  const missingLazyChunkPrefixes = [];
  const leakedToInitial = [];

  for (const prefix of budgets.requiredLazyChunkPrefixes) {
    const inLazy = lazyJsChunks.some((c) => c.name.startsWith(prefix));
    const inInitial = initialJsChunks.some((c) => c.name.startsWith(prefix));
    if (inInitial) leakedToInitial.push(prefix);
    if (inLazy) {
      lazyChunkPrefixesPresent.push(prefix);
    } else {
      missingLazyChunkPrefixes.push(prefix);
    }
  }

  const violations = [];
  if (!appEntryChunk) {
    violations.push('No initial entry JS chunk found in dist/index.html.');
  } else if (appEntryChunk.gzipBytes > budgets.maxAppEntryGzipBytes) {
    violations.push(
      `App entry chunk ${appEntryChunk.name} gzip (${formatKb(appEntryChunk.gzipBytes)}) exceeds budget (${formatKb(budgets.maxAppEntryGzipBytes)}).`,
    );
  }
  if (initialJsGzipBytes > budgets.maxInitialJsGzipBytes) {
    violations.push(
      `Initial JS gzip (${formatKb(initialJsGzipBytes)}) exceeds budget (${formatKb(budgets.maxInitialJsGzipBytes)}).`,
    );
  }
  if (initialCssGzipBytes > budgets.maxInitialCssGzipBytes) {
    violations.push(
      `Initial CSS gzip (${formatKb(initialCssGzipBytes)}) exceeds budget (${formatKb(budgets.maxInitialCssGzipBytes)}).`,
    );
  }
  if (initialTotalGzipBytes > budgets.maxInitialTotalGzipBytes) {
    violations.push(
      `Initial total gzip (${formatKb(initialTotalGzipBytes)}) exceeds budget (${formatKb(budgets.maxInitialTotalGzipBytes)}).`,
    );
  }
  if (largestChunk && largestChunk.rawBytes > budgets.maxSingleChunkRawBytes) {
    violations.push(
      `Largest JS chunk ${largestChunk.name} (${formatKb(largestChunk.rawBytes)}) exceeds ${formatKb(budgets.maxSingleChunkRawBytes)}.`,
    );
  }
  if (missingLazyChunkPrefixes.length > 0) {
    violations.push(`Expected lazy chunks missing: ${missingLazyChunkPrefixes.join(', ')}`);
  }
  if (leakedToInitial.length > 0) {
    violations.push(`Lazy chunks leaked into initial load: ${leakedToInitial.join(', ')}`);
  }

  const estimates = {
    slow3gMs: estimateLoadTimeMs({
      totalTransferBytes: initialTotalGzipBytes,
      rttMs: 400,
      throughputBytesPerSec: 50_000, // 400 kbps
      requestWaves: 2,
    }),
    regular3gMs: estimateLoadTimeMs({
      totalTransferBytes: initialTotalGzipBytes,
      rttMs: 150,
      throughputBytesPerSec: 200_000, // 1.6 Mbps
      requestWaves: 2,
    }),
    mobile4gMs: estimateLoadTimeMs({
      totalTransferBytes: initialTotalGzipBytes,
      rttMs: 60,
      throughputBytesPerSec: 1_125_000, // 9 Mbps
      requestWaves: 2,
    }),
  };

  return {
    measuredAt: new Date().toISOString(),
    distDir,
    html: htmlMetrics,
    counts: {
      totalJsChunks: jsChunks.length,
      initialJsChunks: initialJsChunks.length,
      lazyJsChunks: lazyJsChunks.length,
      initialCssChunks: initialCssChunks.length,
    },
    initial: {
      appEntryChunk: appEntryChunk
        ? {
            name: appEntryChunk.name,
            rawBytes: appEntryChunk.rawBytes,
            gzipBytes: appEntryChunk.gzipBytes,
          }
        : null,
      jsRawBytes: initialJsRawBytes,
      jsGzipBytes: initialJsGzipBytes,
      cssRawBytes: initialCssRawBytes,
      cssGzipBytes: initialCssGzipBytes,
      totalGzipBytes: initialTotalGzipBytes,
      chunks: initialJsChunks.concat(initialCssChunks).sort((a, b) => b.rawBytes - a.rawBytes),
    },
    largestChunk: largestChunk
      ? {
          name: largestChunk.name,
          rawBytes: largestChunk.rawBytes,
          gzipBytes: largestChunk.gzipBytes,
        }
      : null,
    lazyIsolation: {
      present: lazyChunkPrefixesPresent,
      missing: missingLazyChunkPrefixes,
      leakedToInitial,
    },
    estimates,
    budgets,
    violations,
    ok: violations.length === 0,
  };
}

/**
 * Mesure réelle du chargement initial via un serveur HTTP local compressé en gzip
 * et bridé (latence RTT + bande passante mobile 3G lente).
 */
export async function measureThrottledInitialLoad(
  distDir = path.join(ROOT_DIR, 'dist'),
  {
    rttMs = 300,
    bytesPerSec = 50_000, // 400 kbps Slow 3G
    mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  } = {},
) {
  const startedAt = Date.now();
  const requestedPaths = [];

  const sendThrottled = async (res, statusCode, headers, payloadBuffer) => {
    await new Promise((r) => setTimeout(r, rttMs));
    res.writeHead(statusCode, headers);
    const chunkSize = Math.max(4096, Math.round(bytesPerSec / 10)); // 100 ms tranches
    for (let offset = 0; offset < payloadBuffer.length; offset += chunkSize) {
      const slice = payloadBuffer.subarray(offset, offset + chunkSize);
      res.write(slice);
      if (offset + chunkSize < payloadBuffer.length) {
        const delayMs = Math.max(5, Math.round((slice.length / bytesPerSec) * 1000));
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    res.end();
  };

  const server = http.createServer((req, res) => {
    const rawUrl = (req.url ?? '/').split('?')[0];
    requestedPaths.push(rawUrl);

    const relPath = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\/+/, '');
    const resolved = path.resolve(distDir, relPath);
    if (!resolved.startsWith(path.resolve(distDir)) || !fs.existsSync(resolved)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const raw = fs.readFileSync(resolved);
    const gz = gzipSync(raw, { level: 9 });
    const contentType = resolved.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : resolved.endsWith('.js')
        ? 'application/javascript; charset=utf-8'
        : resolved.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'application/octet-stream';

    void sendThrottled(
      res,
      200,
      {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Content-Length': String(gz.length),
      },
      gz,
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const fetchGzipAsset = async (assetPath) => {
    const response = await fetch(`${baseUrl}${assetPath}`, {
      headers: {
        'User-Agent': mobileUserAgent,
        'Accept-Encoding': 'gzip',
      },
    });
    if (!response.ok) {
      throw new Error(`Unexpected HTTP ${response.status} for ${assetPath}`);
    }
    const contentEncoding = response.headers.get('content-encoding');
    const declaredBytes = Number(response.headers.get('content-length') ?? 0);
    const arrayBuf = await response.arrayBuffer();
    const rawBuf = Buffer.from(arrayBuf);
    // Node fetch auto-decompresses gzip responses, so declaredBytes reflects wire size.
    const text =
      contentEncoding === 'gzip' && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b
        ? gunzipSync(rawBuf).toString('utf8')
        : rawBuf.toString('utf8');
    return {
      assetPath,
      wireBytes: declaredBytes || rawBuf.length,
      text,
    };
  };

  try {
    const htmlStart = Date.now();
    const htmlResp = await fetchGzipAsset('/');
    const htmlDurationMs = Date.now() - htmlStart;

    const { scripts, stylesheets } = extractCriticalAssetsFromHtml(htmlResp.text);
    const assetPaths = [...scripts, ...stylesheets];

    const assetResults = await Promise.all(assetPaths.map((assetPath) => fetchGzipAsset(assetPath)));
    const totalDurationMs = Date.now() - startedAt;
    const totalWireBytes = htmlResp.wireBytes + assetResults.reduce((acc, item) => acc + item.wireBytes, 0);

    return {
      baseUrl,
      rttMs,
      bytesPerSec,
      htmlDurationMs,
      totalDurationMs,
      requestCount: 1 + assetResults.length,
      requestedPaths,
      totalWireBytes,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function buildMarkdownReport(metrics, throttled = null) {
  const lines = [
    '### Rapport de taille des bundles & chargement initial (P2)',
    '',
    '| Métrique | Mesuré | Budget CI | Statut |',
    '| --- | --- | --- | --- |',
    `| Entrée app (\`${metrics.initial.appEntryChunk?.name ?? 'index'}\`) | ${formatKb(metrics.initial.appEntryChunk?.gzipBytes ?? 0)} gzip (${formatKb(metrics.initial.appEntryChunk?.rawBytes ?? 0)} brut) | <= ${formatKb(metrics.budgets.maxAppEntryGzipBytes)} gzip | ${(metrics.initial.appEntryChunk?.gzipBytes ?? 0) <= metrics.budgets.maxAppEntryGzipBytes ? 'OK' : 'ÉCHEC'} |`,
    `| JS initial total (${metrics.counts.initialJsChunks} fichiers) | ${formatKb(metrics.initial.jsGzipBytes)} gzip (${formatKb(metrics.initial.jsRawBytes)} brut) | <= ${formatKb(metrics.budgets.maxInitialJsGzipBytes)} gzip | ${metrics.initial.jsGzipBytes <= metrics.budgets.maxInitialJsGzipBytes ? 'OK' : 'ÉCHEC'} |`,
    `| CSS initial | ${formatKb(metrics.initial.cssGzipBytes)} gzip | <= ${formatKb(metrics.budgets.maxInitialCssGzipBytes)} gzip | ${metrics.initial.cssGzipBytes <= metrics.budgets.maxInitialCssGzipBytes ? 'OK' : 'ÉCHEC'} |`,
    `| Total initial HTML+JS+CSS | ${formatKb(metrics.initial.totalGzipBytes)} gzip | <= ${formatKb(metrics.budgets.maxInitialTotalGzipBytes)} gzip | ${metrics.initial.totalGzipBytes <= metrics.budgets.maxInitialTotalGzipBytes ? 'OK' : 'ÉCHEC'} |`,
    `| Plus gros chunk JS | ${formatKb(metrics.largestChunk?.rawBytes ?? 0)} brut (\`${metrics.largestChunk?.name ?? '-'}\`) | <= ${formatKb(metrics.budgets.maxSingleChunkRawBytes)} brut | ${(metrics.largestChunk?.rawBytes ?? 0) <= metrics.budgets.maxSingleChunkRawBytes ? 'OK' : 'ÉCHEC'} |`,
    `| Chunks lazy isolés | ${metrics.counts.lazyJsChunks} chunks (${metrics.lazyIsolation.present.length}/${metrics.budgets.requiredLazyChunkPrefixes.length} clés) | Aucune fuite vers / | ${metrics.lazyIsolation.missing.length === 0 && metrics.lazyIsolation.leakedToInitial.length === 0 ? 'OK' : 'ÉCHEC'} |`,
    '',
    `Temps estimés de téléchargement initial : **Slow 3G (400 kbps / 400ms RTT)** ≈ ${metrics.estimates.slow3gMs} ms · **3G régulière** ≈ ${metrics.estimates.regular3gMs} ms · **Mobile 4G** ≈ ${metrics.estimates.mobile4gMs} ms.`,
  ];

  if (throttled) {
    lines.push(
      `Test réseau bridé réel (${Math.round((throttled.bytesPerSec * 8) / 1000)} kbps, ${throttled.rttMs} ms RTT, mobile UA) : **${throttled.totalDurationMs} ms** pour ${throttled.requestCount} requêtes (${formatKb(throttled.totalWireBytes)} compressés).`,
    );
  }

  if (metrics.violations.length > 0) {
    lines.push('', '**Violations détectées :**');
    for (const v of metrics.violations) {
      lines.push(`- ${v}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let distDir = path.join(ROOT_DIR, 'dist');
  let reportPath = null;
  let runThrottleCheck = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dist' && args[i + 1]) {
      distDir = path.resolve(args[i + 1]);
      i += 1;
    } else if (arg === '--report' && args[i + 1]) {
      reportPath = path.resolve(args[i + 1]);
      i += 1;
    } else if (arg === '--throttle-check') {
      runThrottleCheck = true;
    }
  }

  const metrics = analyzeBuildDirectory(distDir);
  const throttled = runThrottleCheck ? await measureThrottledInitialLoad(distDir) : null;
  const output = { ...metrics, throttled };

  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }

  const markdown = buildMarkdownReport(metrics, throttled);
  console.log(markdown);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8');
  }

  if (!metrics.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main();
}
